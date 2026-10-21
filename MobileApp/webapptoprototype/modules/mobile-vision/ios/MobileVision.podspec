Pod::Spec.new do |s|
  s.name = 'MobileVision'
  s.version = '0.1.0'
  s.summary = 'Bounded offline OCR and image redaction'
  s.description = 'Local image processing for the mobile capture application.'
  s.license = { :type => 'MIT' }
  s.author = 'Web to Prototype'
  s.homepage = 'https://github.com/NarIyirm/Web-AppToPrototype'
  s.source = { :git => 'https://github.com/NarIyirm/Web-AppToPrototype.git' }
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.0'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Vision', 'ImageIO', 'CoreGraphics'
  s.source_files = '**/*.swift'
end
