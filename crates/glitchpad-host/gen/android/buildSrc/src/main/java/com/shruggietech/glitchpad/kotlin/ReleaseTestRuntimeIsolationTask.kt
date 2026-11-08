package com.shruggietech.glitchpad.kotlin

import java.io.ByteArrayInputStream
import java.io.File
import java.util.TreeMap
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream
import org.gradle.api.DefaultTask
import org.gradle.api.file.ConfigurableFileCollection
import org.gradle.api.file.Directory
import org.gradle.api.file.RegularFile
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.provider.ListProperty
import org.gradle.api.tasks.Classpath
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.TaskAction
import org.objectweb.asm.ClassReader
import org.objectweb.asm.ClassWriter
import org.objectweb.asm.commons.ClassRemapper
import org.objectweb.asm.commons.Remapper

/** Isolate only test copies of runtimes whose optimized app ABI cannot serve external callers. */
abstract class ReleaseTestRuntimeIsolationTask : DefaultTask() {
    @get:Classpath abstract val inputJars: ListProperty<RegularFile>
    @get:Classpath abstract val inputDirectories: ListProperty<Directory>
    @get:Classpath abstract val sharedRuntimeInputs: ConfigurableFileCollection
    @get:OutputFile abstract val outputJar: RegularFileProperty

    init {
        outputJar.convention(project.layout.buildDirectory.file("intermediates/$name/classes.jar"))
    }

    @TaskAction fun isolate() = isolateReleaseTestRuntime(
        inputJars.get().map { it.asFile }, inputDirectories.get().map { it.asFile }, sharedRuntimeInputs.files.toList(), outputJar.get().asFile,
    )
}

fun isolateReleaseTestRuntime(inputJars: List<File>, inputDirectories: List<File>, sharedRuntimeInputs: List<File>, destination: File) {
    val entries = TreeMap<String, ByteArray>()
    val remapper = object : Remapper() {
        override fun map(name: String): String = when {
            name.startsWith("kotlin/") || name.startsWith("androidx/tracing/") ->
                "com/shruggietech/glitchpad/testisolated/" + name
            else -> name
        }

        override fun mapValue(value: Any?): Any? {
            if (value is String && (value.startsWith("kotlin.") || value.startsWith("androidx.tracing.")))
                return map(value.replace('.', '/')).replace('/', '.')
            return super.mapValue(value)
        }
    }
    fun add(name: String, bytes: ByteArray, seed: Boolean) {
        if (name == "module-info.class" || name.startsWith("META-INF/versions/")) return
        val shared = name.startsWith("kotlin/") || name.startsWith("androidx/tracing/")
        if (seed && !shared) return
        if (!name.endsWith(".class")) {
            if (shared && !name.endsWith("/")) {
                val mappedName = remapper.map(name)
                val previous = entries.putIfAbsent(mappedName, bytes)
                require(previous == null || previous.contentEquals(bytes)) { "Conflicting isolated test resource: $mappedName" }
            }
            return
        }
        val reader = ClassReader(bytes)
        val writer = ClassWriter(0)
        reader.accept(ClassRemapper(writer, remapper), 0)
        val mappedName = remapper.map(reader.className) + ".class"
        val mapped = writer.toByteArray()
        val previous = entries.putIfAbsent(mappedName, mapped)
        require(previous == null || previous.contentEquals(mapped)) { "Conflicting isolated test class: $mappedName" }
    }
    fun archive(bytes: ByteArray, seed: Boolean) {
        ZipInputStream(ByteArrayInputStream(bytes)).use { input ->
            var entry = input.nextEntry
            while (entry != null) {
                if (!entry.isDirectory) add(entry.name, input.readBytes(), seed)
                entry = input.nextEntry
            }
        }
    }
    fun read(file: File, seed: Boolean) {
        if (file.isDirectory) {
            file.walkTopDown().filter { it.isFile }.forEach { add(it.relativeTo(file).invariantSeparatorsPath, it.readBytes(), seed) }
        } else if (file.extension == "aar") {
            ZipInputStream(file.inputStream()).use { input ->
                var entry = input.nextEntry
                while (entry != null) {
                    if (entry.name == "classes.jar" || entry.name.startsWith("libs/") && entry.name.endsWith(".jar"))
                        archive(input.readBytes(), seed)
                    entry = input.nextEntry
                }
            }
        } else archive(file.readBytes(), seed)
    }
    inputJars.forEach { read(it, false) }
    inputDirectories.forEach { read(it, false) }
    sharedRuntimeInputs.sortedBy { it.absolutePath }.forEach { read(it, true) }
    for (required in listOf("kotlin/jvm/internal/Intrinsics.class", "androidx/tracing/Trace.class"))
        require(entries.containsKey("com/shruggietech/glitchpad/testisolated/" + required)) {
            "Unfiltered compile runtime is missing $required"
        }
    destination.parentFile.mkdirs()
    ZipOutputStream(destination.outputStream()).use { output ->
        entries.forEach { (name, bytes) ->
            output.putNextEntry(ZipEntry(name).apply { time = 0 })
            output.write(bytes)
            output.closeEntry()
        }
    }
}
