package com.menumaker.ui

import com.google.common.truth.Truth.assertThat
import com.menumaker.data.repository.PaymentRepository
import com.menumaker.services.AnalyticsService
import com.menumaker.viewmodel.CustomerPaymentViewModel
import com.menumaker.viewmodel.PaymentMethodType
import com.menumaker.viewmodel.TokenizedPaymentMethod
import io.kotest.property.Arb
import io.kotest.property.arbitrary.arbitrary
import io.kotest.property.checkAll
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.mockito.Mock
import org.mockito.MockitoAnnotations

@ExperimentalCoroutinesApi
class CheckoutValidationPropertyTest {

    @Mock private lateinit var paymentRepository: PaymentRepository
    @Mock private lateinit var analyticsService: AnalyticsService

    private lateinit var viewModel: CustomerPaymentViewModel
    private val testDispatcher = UnconfinedTestDispatcher()

    @Before
    fun setup() {
        MockitoAnnotations.openMocks(this)
        Dispatchers.setMain(testDispatcher)
        viewModel = CustomerPaymentViewModel(analyticsService, paymentRepository)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun arbPanLikeInput(): Arb<String> = arbitrary { rs ->
        val patterns = listOf(
            "4111111111111111",
            "5500000000000004",
            "340000000000009",
            "4111111111111",
            "4111-1111-1111-1111"
        )
        patterns.random(rs.random)
    }

    private fun arbTokenReference(): Arb<String> = arbitrary { rs ->
        val suffix = (1..12).map { ('a'..'z').random(rs.random) }.joinToString("")
        "pm_$suffix"
    }

    /**
     * Raw card details are never sufficient after the secure payment boundary work.
     * The provider SDK must tokenize the method first.
     */
    @Test
    fun `property - raw card details block checkout`() = runTest {
        checkAll(
            iterations = 100,
            arbPanLikeInput()
        ) { cardInput ->
            viewModel = CustomerPaymentViewModel(analyticsService, paymentRepository)
            viewModel.setPaymentMethod(PaymentMethodType.CARD)

            viewModel.updateCardNumber(cardInput)
            viewModel.updateCardHolderName("Provider Customer")
            viewModel.updateExpiryDate("12/35")
            viewModel.updateCvv("123")

            assertFalse(viewModel.isPayButtonEnabled())
            assertThat(viewModel.cardNumber.value).doesNotContain(cardInput)
            assertThat(viewModel.cvv.value).isEmpty()
        }
    }

    @Test
    fun `property - tokenized card methods allow checkout`() = runTest {
        checkAll(
            iterations = 100,
            arbTokenReference()
        ) { token ->
            viewModel = CustomerPaymentViewModel(analyticsService, paymentRepository)
            viewModel.replaceTokenizedPaymentMethodsForTesting(listOf(card(tokenReference = token)))
            viewModel.selectSavedCard(0)

            assertTrue(viewModel.isPayButtonEnabled())
        }
    }

    @Test
    fun `property - expired tokenized card methods block checkout`() = runTest {
        checkAll(
            iterations = 25,
            arbTokenReference()
        ) { token ->
            viewModel = CustomerPaymentViewModel(analyticsService, paymentRepository)
            viewModel.replaceTokenizedPaymentMethodsForTesting(listOf(card(tokenReference = token, expiryYear = 2020)))
            viewModel.selectSavedCard(0)

            assertFalse(viewModel.isPayButtonEnabled())
        }
    }

    @Test
    fun `property - raw UPI text does not allow checkout without provider token`() = runTest {
        viewModel.setPaymentMethod(PaymentMethodType.UPI)
        viewModel.updateUpiId("user@upi")

        assertFalse(viewModel.isPayButtonEnabled())
    }

    @Test
    fun `property - tokenized UPI methods allow checkout`() = runTest {
        checkAll(
            iterations = 50,
            arbTokenReference()
        ) { token ->
            viewModel = CustomerPaymentViewModel(analyticsService, paymentRepository)
            viewModel.replaceTokenizedPaymentMethodsForTesting(listOf(upi(tokenReference = token)))
            viewModel.selectSavedCard(0)

            assertTrue(viewModel.isPayButtonEnabled())
        }
    }

    @Test
    fun `property - cash payment always allows checkout`() = runTest {
        viewModel.setPaymentMethod(PaymentMethodType.CASH)

        assertTrue(viewModel.isPayButtonEnabled())
    }

    @Test
    fun `property - invalid visible card entry gets provider guidance`() = runTest {
        viewModel.setPaymentMethod(PaymentMethodType.CARD)
        viewModel.updateCardNumber("1234")

        assertThat(viewModel.cardValidationError.value).contains("provider")
        assertFalse(viewModel.isPayButtonEnabled())
    }

    private fun card(
        tokenReference: String,
        expiryYear: Int = 2035
    ) = TokenizedPaymentMethod(
        id = "card-$tokenReference",
        type = PaymentMethodType.CARD,
        provider = "stripe",
        tokenReference = tokenReference,
        brand = "visa",
        last4 = "4242",
        expiryMonth = 12,
        expiryYear = expiryYear,
        billingName = "Provider Customer"
    )

    private fun upi(tokenReference: String) = TokenizedPaymentMethod(
        id = "upi-$tokenReference",
        type = PaymentMethodType.UPI,
        provider = "stripe",
        tokenReference = tokenReference,
        brand = null,
        last4 = null,
        expiryMonth = null,
        expiryYear = null,
        billingName = "Provider Customer"
    )
}
