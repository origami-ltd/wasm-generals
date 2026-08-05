# GeneralsX @feature Codex 04/08/2026 Define the shared Emscripten WebGPU contract.
if(NOT EMSCRIPTEN)
    message(FATAL_ERROR "WebGPU browser builds require Emscripten")
endif()

# GeneralsX @build Codex 04/08/2026 Keep the browser runtime single-threaded until game work is explicitly moved to workers.
add_compile_options(-fexceptions)

add_library(webgpu_runtime INTERFACE)
target_compile_definitions(webgpu_runtime INTERFACE SAGE_USE_WEBGPU)
target_compile_options(webgpu_runtime INTERFACE
    --use-port=emdawnwebgpu
    -fexceptions
)
target_link_options(webgpu_runtime INTERFACE
    --use-port=emdawnwebgpu
    -fexceptions
	# GeneralsX @feature Codex 04/08/2026 Suspend synchronous legacy initialization while WebGPU requests resolve.
	"-sASYNCIFY=1"
    # GeneralsX @port Codex 04/08/2026 Match the native process stack required by legacy global-data initialization.
    "-sSTACK_SIZE=1048576"
    # GeneralsX @build Codex 05/08/2026 Fixed 4 GiB heap: the wasm32 cap, no growth so heap views never detach
    # (ALLOW_MEMORY_GROWTH broke emdawnwebgpu uploads → black canvas, and resizable buffers broke TextDecoder).
    # ponytail: going past 4 GiB requires a MEMORY64 rebuild. Pages are committed lazily, so RSS only grows with use.
    "-sINITIAL_MEMORY=4294901760"
)
