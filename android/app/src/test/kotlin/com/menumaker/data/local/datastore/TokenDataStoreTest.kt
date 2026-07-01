package com.menumaker.data.local.datastore

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class TokenDataStoreTest {
    @Test
    fun `encoded storage does not contain plaintext tokens`() {
        val alias = TokenDataStore.secureAliasForFlavor("seller")
        val encoded = TokenDataStore.encodeForSecureStorage("refresh-secret-token", alias)

        assertTrue(encoded.startsWith("ks1:"))
        assertFalse(encoded.contains("refresh-secret-token"))
        assertEquals("refresh-secret-token", TokenDataStore.decodeFromSecureStorage(encoded, alias))
    }

    @Test
    fun `seller and customer aliases are isolated`() {
        val sellerAlias = TokenDataStore.secureAliasForFlavor("seller")
        val customerAlias = TokenDataStore.secureAliasForFlavor("customer")
        val encoded = TokenDataStore.encodeForSecureStorage("token", sellerAlias)

        assertNotEquals(sellerAlias, customerAlias)
        assertEquals("token", TokenDataStore.decodeFromSecureStorage(encoded, sellerAlias))
        assertNull(TokenDataStore.decodeFromSecureStorage(encoded, customerAlias))
    }

    @Test
    fun `invalid encrypted value wipes by returning null`() {
        assertNull(TokenDataStore.decodeFromSecureStorage("not-encrypted", TokenDataStore.secureAliasForFlavor("seller")))
        assertNull(TokenDataStore.decodeFromSecureStorage("ks1:not-valid-base64", TokenDataStore.secureAliasForFlavor("seller")))
    }
}
