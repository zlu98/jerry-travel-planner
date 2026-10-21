// macOS 26+ 本机听写。仅读取调用方提供的临时音频，输出 JSON，不保留音频。
import Foundation
import Speech
import AVFoundation

func output(_ value: [String: Any]) {
    if let data = try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]),
       let text = String(data: data, encoding: .utf8) { print(text); fflush(stdout) }
}
let wait = DispatchSemaphore(value: 0)
Task {
    do {
        guard #available(macOS 26.0, *) else { throw NSError(domain: "voice", code: 1, userInfo: [NSLocalizedDescriptionKey: "需要 macOS 26 或更新版本"]) }
        guard let locale = await SpeechTranscriber.supportedLocale(equivalentTo: Locale(identifier: "zh_CN")) else { throw NSError(domain: "voice", code: 2, userInfo: [NSLocalizedDescriptionKey: "本机不支持中文听写"]) }
        let transcriber = SpeechTranscriber(locale: locale, preset: .transcription)
        if CommandLine.arguments.count == 2 && CommandLine.arguments[1] == "--install" {
            if let request = try await AssetInventory.assetInstallationRequest(supporting: [transcriber]) { try await request.downloadAndInstall() }
            output(["ok": true, "installed": true]); wait.signal(); return
        }
        let installation = try await AssetInventory.assetInstallationRequest(supporting: [transcriber])
        guard installation == nil else { throw NSError(domain: "voice", code: 3, userInfo: [NSLocalizedDescriptionKey: "请先安装系统中文听写模型，本工具不自动下载模型"]) }
        if CommandLine.arguments.count == 2 && CommandLine.arguments[1] == "--check" {
            output(["ok": true, "engine": "macos-local", "locale": locale.identifier])
        } else {
            guard CommandLine.arguments.count == 2 else { throw NSError(domain: "voice", code: 4, userInfo: [NSLocalizedDescriptionKey: "缺少音频文件"]) }
            let analyzer = SpeechAnalyzer(modules: [transcriber])
            let resultTask = Task { () throws -> String in
                var parts: [String] = []
                for try await result in transcriber.results { parts.append(String(result.text.characters)) }
                return parts.joined()
            }
            let file = try AVAudioFile(forReading: URL(fileURLWithPath: CommandLine.arguments[1]))
            if let end = try await analyzer.analyzeSequence(from: file) { try await analyzer.finalizeAndFinish(through: end) }
            output(["ok": true, "text": try await resultTask.value, "engine": "macos-local"])
        }
    } catch {
        output(["ok": false, "error": error.localizedDescription])
    }
    wait.signal()
}
wait.wait()
