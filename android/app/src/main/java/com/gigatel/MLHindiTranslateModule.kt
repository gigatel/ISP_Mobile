package com.isp.react

import com.facebook.react.bridge.*
import com.google.mlkit.nl.translate.*
import com.google.mlkit.common.model.DownloadConditions

class MLHindiTranslateModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "MLHindiTranslate"

    private val translator: Translator by lazy {
        val options = TranslatorOptions.Builder()
            .setSourceLanguage(TranslateLanguage.ENGLISH)
            .setTargetLanguage(TranslateLanguage.HINDI)
            .build()
        Translation.getClient(options)
    }

    @ReactMethod
    fun translate(text: String, promise: Promise) {

        if (text.trim().isEmpty()) {
            promise.resolve(text)
            return
        }

        val conditions = DownloadConditions.Builder()
            .requireWifi()   // ⭐ Optional (No mobile data issue)
            .build()

        // ⭐ First ensure model is downloaded
        translator.downloadModelIfNeeded(conditions)
            .addOnSuccessListener {

                // ⭐ Now translate
                translator.translate(text)
                    .addOnSuccessListener { translated ->
                        promise.resolve(translated)
                    }
                    .addOnFailureListener { e ->
                        promise.reject("TRANSLATE_FAILED", e)
                    }

            }
            .addOnFailureListener { e ->
                // ⭐ Model failed to download
                promise.reject("MODEL_DOWNLOAD_FAILED", e)
            }
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        translator.close()
    }
}
