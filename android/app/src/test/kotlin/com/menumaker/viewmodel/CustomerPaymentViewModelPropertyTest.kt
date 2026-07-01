package com.menumaker.viewmodel

import com.menumaker.data.repository.PaymentRepository
import com.menumaker.services.AnalyticsService
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
import org.mockito.Mockito.reset
import org.mockito.MockitoAnnotations

@ExperimentalCoroutinesApi
class PaymentValidationPropertyTest {

    @Mock
    private lateinit var analyticsService: AnalyticsService

    @Mock
    private lateinit var paymentRepository: PaymentRepository

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
        val length = (13..19).random(rs.random)
        (1..length).map { ('0'..'9').random(rs.random) }.joinToString("")
    }

    private fun arbSafeToken(): Arb<String> = arbitrary { rs ->
        val suffix = (1..12).map { ('a'..'z').random(rs.random) }.joinToString("")
        "pm_$suffix"
    }

    @Test
    fun `property - PAN-like input never enables card payment without provider token`() = runTest {
        checkAll(iterations = 100, arbPanLikeInput()) { panLikeInput ->
            reset(analyticsService, paymentRepository)
            viewModel = CustomerPaymentViewModel(analyticsService, paymentRepository)

            viewModel.updateCardNumber(panLikeInput)
            viewModel.updateExpiryDate("12/35")
            viewModel.updateCardHolderName("Provider Customer")
            viewModel.updateCvv("123")

            assertFalse(viewModel.isPayButtonEnabled())
            assertFalse(viewModel.cardNumber.value.contains(panLikeInput))
            assertTrue(viewModel.cvv.value.isEmpty())
        }
    }

    @Test
    fun `property - valid tokenized card references enable card payment`() = runTest {
        checkAll(iterations = 100, arbSafeToken()) { token ->
            reset(analyticsService, paymentRepository)
            viewModel = CustomerPaymentViewModel(analyticsService, paymentRepository)

            viewModel.replaceTokenizedPaymentMethodsForTesting(
                listOf(
                    TokenizedPaymentMethod(
                        id = "pm-card",
                        type = PaymentMethodType.CARD,
                        provider = "stripe",
                        tokenReference = token,
                        brand = "visa",
                        last4 = "4242",
                        expiryMonth = 12,
                        expiryYear = 2035,
                        billingName = "Provider Customer"
                    )
                )
            )
            viewModel.selectSavedCard(0)

            assertTrue(viewModel.isPayButtonEnabled())
        }
    }
}
