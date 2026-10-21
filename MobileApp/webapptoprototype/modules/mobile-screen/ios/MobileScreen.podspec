Pod::Spec.new do |s|
  s.name = 'MobileScreen'
  s.version = '0.1.0'
  s.summary = 'ReplayKit system picker and bounded shared frame inbox'
  s.description = 'Native lifecycle for mobile interface capture.'
  s.license = { :type => 'MIT' }
  s.author = 'Web to Prototype'
  s.homepage = 'https://github.com/NarIyirm/Web-AppToPrototype'
  s.source = { :git => 'https://github.com/NarIyirm/Web-AppToPrototype.git' }
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.0'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'ReplayKit', 'UIKit'
  s.source_files = '**/*.swift'
end
