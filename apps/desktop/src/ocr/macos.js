// JavaScript for Automation bridges directly to the installed Vision framework.
// No Apple events, network, developer tools or external application are used.
ObjC.import('Foundation');
ObjC.import('AppKit');
ObjC.import('Vision');
function run(args) {
  if (args.length !== 1) throw Error('M_OCR_IMAGE');
  const data = $.NSData.dataWithContentsOfFile(args[0]);
  const image = $.NSBitmapImageRep.imageRepWithData(data);
  const width = Number(image.pixelsWide), height = Number(image.pixelsHigh);
  if (!(width > 0 && height > 0 && width <= 4096 && height <= 4096)) throw Error('M_OCR_IMAGE');
  const request = $.VNRecognizeTextRequest.alloc.init;
  request.recognitionLevel = 0; // VNRequestTextRecognitionLevelAccurate
  const error = Ref();
  const supported = ObjC.deepUnwrap(request.supportedRecognitionLanguagesAndReturnError(error));
  const wanted = ['zh-Hans', 'zh-Hant', 'en-US'].filter(language => supported.indexOf(language) >= 0);
  if (wanted.length) request.recognitionLanguages = $(wanted);
  request.usesLanguageCorrection = true;
  const handler = $.VNImageRequestHandler.alloc.initWithURLOptions($.NSURL.fileURLWithPath(args[0]), $({}));
  if (!handler.performRequestsError($([request]), error)) throw Error('M_OCR_FAILED');
  const observations = [], results = request.results;
  for (let i = 0; i < Math.min(Number(results.count), 500); i++) {
    const observation = results.objectAtIndex(i), candidates = observation.topCandidates(1);
    if (!Number(candidates.count)) continue;
    const candidate = candidates.objectAtIndex(0), confidence = Number(candidate.confidence);
    if (confidence < .35) continue;
    const rect = observation.boundingBox;
    observations.push({ text: ObjC.unwrap(candidate.string), confidence, provenance: 'ocr', bounds: {
      x: Math.max(0, rect.origin.x * width), y: Math.max(0, (1 - rect.origin.y - rect.size.height) * height),
      width: rect.size.width * width, height: rect.size.height * height,
    } });
  }
  return JSON.stringify({ width, height, observations });
}
