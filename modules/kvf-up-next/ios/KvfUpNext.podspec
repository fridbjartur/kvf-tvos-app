Pod::Spec.new do |s|
  s.name           = 'KvfUpNext'
  s.version        = '1.0.0'
  s.summary        = 'Native Up Next button for the tvOS player'
  s.description    = 'Adds a next-episode button to the AVPlayerViewController transport bar.'
  s.author         = ''
  s.homepage       = 'https://github.com/fridbjartur/kvf-tvos-app'
  s.license        = 'MIT'
  s.platforms      = { :ios => '15.1', :tvos => '15.0' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,swift}'
end
