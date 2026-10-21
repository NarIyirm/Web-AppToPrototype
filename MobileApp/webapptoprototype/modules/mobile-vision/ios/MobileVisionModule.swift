import CoreGraphics
import ExpoModulesCore
import Foundation
import ImageIO
import UniformTypeIdentifiers
import Vision

public final class MobileVisionModule: Module {
  private static func load(_ uri: String) throws -> CGImage {
    guard let url = URL(string: uri), url.isFileURL,
      let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first
    else { throw NSError(domain: "M_ASSET_INVALID", code: 1) }
    let root = documents.appendingPathComponent("mobile-captures/assets").resolvingSymlinksInPath().standardizedFileURL
    let file = url.resolvingSymlinksInPath().standardizedFileURL
    let validName = file.lastPathComponent.range(of: "^[a-f0-9]{64}\\.png$", options: .regularExpression) != nil
    let values = try file.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey])
    guard file.deletingLastPathComponent() == root, validName, values.isRegularFile == true,
      let bytes = values.fileSize, bytes > 0, bytes <= 10 * 1024 * 1024,
      let source = CGImageSourceCreateWithURL(file as CFURL, nil),
      let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
      let width = properties[kCGImagePropertyPixelWidth] as? Int,
      let height = properties[kCGImagePropertyPixelHeight] as? Int,
      (1...4096).contains(width), (1...4096).contains(height),
      let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
    else { throw NSError(domain: "M_ASSET_INVALID", code: 2) }
    return image
  }

  public func definition() -> ModuleDefinition {
    Name("MobileVision")
    AsyncFunction("recognize") { (uri: String) throws -> [String: Any] in
      let image = try Self.load(uri)
      let request = VNRecognizeTextRequest()
      request.recognitionLevel = .accurate
      let supported = try request.supportedRecognitionLanguages()
      let wanted = ["zh-Hans", "zh-Hant", "en-US"].filter { supported.contains($0) }
      guard !wanted.isEmpty else { throw NSError(domain: "M_OCR_LANGUAGE_UNAVAILABLE", code: 1) }
      request.recognitionLanguages = wanted
      request.usesLanguageCorrection = true
      try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
      let observations = request.results ?? []
      guard observations.count <= 5000 else { throw NSError(domain: "M_LIMIT_EXCEEDED", code: 1) }
      var textUnits = 0
      let lines: [[String: Any]] = try observations.compactMap { observation in
        guard let candidate = observation.topCandidates(1).first else { return nil }
        textUnits += candidate.string.utf16.count
        guard textUnits <= 500000 else { throw NSError(domain: "M_LIMIT_EXCEEDED", code: 2) }
        let rect = observation.boundingBox
        return ["text": candidate.string, "confidence": Double(candidate.confidence), "provenance": "ocr",
          "bounds": ["x": max(0, rect.minX * Double(image.width)),
            "y": max(0, (1 - rect.maxY) * Double(image.height)),
            "width": rect.width * Double(image.width), "height": rect.height * Double(image.height)]]
      }
      return ["width": image.width, "height": image.height, "observations": lines]
    }.runOnQueue(DispatchQueue(label: "mobile.vision.ocr", qos: .userInitiated))

    AsyncFunction("redact") { (uri: String, regions: [[String: Double]]) throws -> String in
      let image = try Self.load(uri)
      guard (1...100).contains(regions.count),
        let context = CGContext(data: nil, width: image.width, height: image.height, bitsPerComponent: 8,
          bytesPerRow: image.width * 4, space: CGColorSpaceCreateDeviceRGB(),
          bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
      else { throw NSError(domain: "M_ASSET_INVALID", code: 3) }
      context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
      context.setFillColor(CGColor(gray: 0, alpha: 1))
      for region in regions {
        guard let x = region["x"], let y = region["y"], let width = region["width"], let height = region["height"],
          [x, y, width, height].allSatisfy({ $0.isFinite }), x >= 0, y >= 0, width > 0, height > 0,
          x + width <= Double(image.width), y + height <= Double(image.height)
        else { throw NSError(domain: "M_ASSET_INVALID", code: 4) }
        context.fill(CGRect(x: x, y: Double(image.height) - y - height, width: width, height: height))
      }
      guard let output = context.makeImage() else { throw NSError(domain: "M_ASSET_INVALID", code: 5) }
      let url = FileManager.default.temporaryDirectory.appendingPathComponent("redacted-\(UUID().uuidString).png")
      guard let destination = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil)
      else { throw NSError(domain: "M_ASSET_INVALID", code: 6) }
      CGImageDestinationAddImage(destination, output, nil)
      guard CGImageDestinationFinalize(destination) else { throw NSError(domain: "M_ASSET_INVALID", code: 7) }
      return url.absoluteString
    }.runOnQueue(DispatchQueue(label: "mobile.vision.redaction", qos: .userInitiated))
  }
}
