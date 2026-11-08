package com.shruggietech.glitchpad.kotlin

import java.io.ByteArrayOutputStream
import java.io.File
import java.net.URLClassLoader
import java.nio.file.Files
import java.util.zip.ZipEntry
import java.util.zip.ZipFile
import java.util.zip.ZipOutputStream
import org.junit.Assert.*
import org.junit.Test
import org.objectweb.asm.ClassWriter
import org.objectweb.asm.Opcodes

class IsolationCaller {
    fun echo(text: String): String = text
    fun runtimeName(): String = "kotlin.jvm.internal.Intrinsics"
}

class ReleaseTestRuntimeIsolationTest {
    @Test fun isolatedRuntimePreservesTheCallerAbiWithoutProductClasses() {
        val temporary = Files.createTempDirectory("s048-test-runtime-").toFile()
        try {
            val inputs = File(temporary, "caller").apply { mkdirs() }
            val callerName = IsolationCaller::class.java.name.replace('.', '/') + ".class"
            File(inputs, callerName).apply {
                parentFile.mkdirs()
                writeBytes(IsolationCaller::class.java.classLoader.getResourceAsStream(callerName)!!.use { it.readBytes() })
            }
            val stdlib = File(kotlin.jvm.internal.Intrinsics::class.java.protectionDomain.codeSource.location.toURI())
            val trace = File(temporary, "trace.aar")
            val traceClass = ClassWriter(0).apply {
                visit(Opcodes.V1_8, Opcodes.ACC_PUBLIC, "androidx/tracing/Trace", null, "java/lang/Object", null)
                visitEnd()
            }.toByteArray()
            val jar = ByteArrayOutputStream()
            ZipOutputStream(jar).use { output ->
                output.putNextEntry(ZipEntry("androidx/tracing/Trace.class"))
                output.write(traceClass)
                output.closeEntry()
                output.putNextEntry(ZipEntry("androidx/tracing/fixture.txt"))
                output.write("retained test runtime resource".toByteArray())
                output.closeEntry()
            }
            ZipOutputStream(trace.outputStream()).use { output ->
                output.putNextEntry(ZipEntry("classes.jar"))
                output.write(jar.toByteArray())
                output.closeEntry()
            }
            val destination = File(temporary, "isolated.jar")
            isolateReleaseTestRuntime(emptyList(), listOf(inputs), listOf(stdlib, trace), destination)
            ZipFile(destination).use { archive ->
                assertNotNull(archive.getEntry("com/shruggietech/glitchpad/testisolated/kotlin/jvm/internal/Intrinsics.class"))
                assertNotNull(archive.getEntry("com/shruggietech/glitchpad/testisolated/androidx/tracing/Trace.class"))
                assertNotNull(archive.getEntry("com/shruggietech/glitchpad/testisolated/androidx/tracing/fixture.txt"))
                assertNull(archive.getEntry("kotlin/jvm/internal/Intrinsics.class"))
                assertNull(archive.getEntry("androidx/tracing/Trace.class"))
            }
            // Platform-only parent: a missed rewrite cannot borrow Gradle's Kotlin runtime.
            URLClassLoader(arrayOf(destination.toURI().toURL()), ClassLoader.getPlatformClassLoader()).use { loader ->
                val caller = loader.loadClass(IsolationCaller::class.java.name)
                val instance = caller.getConstructor().newInstance()
                assertEquals("actual ABI call", caller.getMethod("echo", String::class.java).invoke(instance, "actual ABI call"))
                assertEquals("com.shruggietech.glitchpad.testisolated.kotlin.jvm.internal.Intrinsics", caller.getMethod("runtimeName").invoke(instance))
                try {
                    caller.getMethod("echo", String::class.java).invoke(instance, null)
                    fail("the relocated null-check method must execute")
                } catch (failure: java.lang.reflect.InvocationTargetException) {
                    assertTrue(failure.cause is NullPointerException)
                    assertTrue(failure.cause!!.message!!.contains("text"))
                }
            }
            val repeated = File(temporary, "repeated.jar")
            isolateReleaseTestRuntime(emptyList(), listOf(inputs), listOf(stdlib, trace), repeated)
            assertArrayEquals(destination.readBytes(), repeated.readBytes())
            try {
                isolateReleaseTestRuntime(emptyList(), listOf(inputs), listOf(stdlib), File(temporary, "incomplete.jar"))
                fail("missing test-local Trace must reject the build")
            } catch (failure: IllegalArgumentException) {
                assertTrue(failure.message!!.contains("Trace.class"))
            }
        } finally {
            temporary.deleteRecursively()
        }
    }
}
