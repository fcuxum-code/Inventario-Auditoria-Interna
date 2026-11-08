import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.fcuxum.mascota"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.fcuxum.mascota"
        minSdk = 26
        targetSdk = 34
        versionCode = 5
        versionName = "0.5-beta"
    }

    // Llave fija para que cada nueva versión beta se instale encima de la anterior.
    signingConfigs {
        getByName("debug") {
            storeFile = file("debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }
    buildTypes {
        getByName("debug") { signingConfig = signingConfigs.getByName("debug") }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        isCoreLibraryDesugaringEnabled = true
    }

    packaging {
        resources {
            excludes += listOf(
                "/META-INF/{AL2.0,LGPL2.1}",
                "META-INF/DEPENDENCIES",
                "META-INF/LICENSE*",
                "META-INF/NOTICE*",
                "META-INF/INDEX.LIST",
                "META-INF/versions/9/OSGI-INF/MANIFEST.MF",
                "META-INF/FastDoubleParser-*",
            )
        }
    }
}

kotlin {
    compilerOptions { jvmTarget.set(JvmTarget.JVM_17) }
}

dependencies {
    implementation("com.anthropic:anthropic-java:3.6.0")
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
}
