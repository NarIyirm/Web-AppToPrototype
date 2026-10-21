Pod::Spec.new do |s|
  s.name = 'MobileTransfer'
  s.version = '0.1.0'
  s.summary = 'Private-network certificate-pinned mobile material transport'
  s.description = 'Per-session TLS identity verification without global trust exceptions.'
  s.license = { :type => 'MIT' }
  s.author = 'Web to Prototype'
  s.homepage = 'https://github.com/NarIyirm/Web-AppToPrototype'
  s.source = { :git => 'https://github.com/NarIyirm/Web-AppToPrototype.git' }
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.0'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Security', 'CryptoKit'
  s.source_files = '**/*.swift'
end
