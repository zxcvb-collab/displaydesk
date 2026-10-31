plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "app.displaydesk.tv"
    compileSdk = 34

    defaultConfig {
        applicationId = "app.displaydesk.tv"
        minSdk = 22
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
        // The web player this app wraps; change for staging builds.
        buildConfigField("String", "BASE_URL", "\"https://displaydesk.vercel.app\"")
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Signed with the debug key so the APK can be sideloaded without
            // a keystore; swap for a real signing config before any store upload.
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}
