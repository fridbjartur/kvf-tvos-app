# tvOS Flattened Icons

This directory contains flattened composite images used by the `@react-native-tvos/config-tv` plugin to automatically generate tvOS app icons and top shelf images during prebuild.

## Files

### App Icons (Composites from backup sources)

These images are created by compositing the three layers (back, middle, front) from the backup in `Images.xcassets/Brand Assets.brandassets/`:

- **icon-400x240.png** - Home screen icon @1x
- **icon-800x480.png** - Home screen icon @2x
- **icon-1280x768.png** - App Store icon (large)

### Top Shelf Images (Copied from Images.xcassets backup)

These are direct copies from the backup in `Images.xcassets/Brand Assets.brandassets/`:

- **topshelf-1920x720.png** - Top shelf @1x
- **topshelf-3840x1440.png** - Top shelf @2x
- **topshelf-wide-2320x720.png** - Top shelf wide @1x
- **topshelf-wide-4640x1440.png** - Top shelf wide @2x

## Automatic Generation

These images are automatically processed by the `@react-native-tvos/config-tv` plugin during `npm run prebuild` when `EXPO_TV=1` is set. The plugin:

1. Creates `TVAppIcon.brandassets` in the iOS project
2. Generates imagestack layers from the flattened icons
3. Copies top shelf images for the tvOS home screen
4. Configures the Xcode project to use these assets

See `app.json` plugin configuration and `CLAUDE-tvos-icons.md` for more details.

## Regenerating Composite Icons

If you need to regenerate the composite icons from the backup source layers in `Images.xcassets/Brand Assets.brandassets/`, use this Python script:

```python
#!/usr/bin/env python3
from PIL import Image
import os

def composite_layers(back_path, middle_path, front_path, output_path):
    back = Image.open(back_path).convert('RGBA')
    middle = Image.open(middle_path).convert('RGBA')
    front = Image.open(front_path).convert('RGBA')
    result = Image.alpha_composite(Image.alpha_composite(back, middle), front)
    result.convert('RGB').save(output_path, 'PNG')

base = 'Images.xcassets/Brand Assets.brandassets'
output = 'assets/images/tvos-flattened'

# Composite the icons
composites = [
    ('icon-400x240.png', 'App Icon.imagestack', '@1x'),
    ('icon-800x480.png', 'App Icon.imagestack', '@2x'),
    ('icon-1280x768.png', 'App Icon - App Store.imagestack', '@1x'),
]

for name, stack, scale in composites:
    suffix = scale.replace('@', '@') if scale != '@1x' else '@1x' if '800' in name else ''
    if 'App Store' in stack:
        suffix = '@1x' if scale == '@1x' else ''

    back = f'{base}/{stack}/Back.imagestacklayer/Content.imageset/back{suffix}.png'
    middle = f'{base}/{stack}/Middle.imagestacklayer/Content.imageset/middle{suffix}.png'
    front = f'{base}/{stack}/Front.imagestacklayer/Content.imageset/front{suffix}.png'

    composite_layers(back, middle, front, f'{output}/{name}')
```

This composites the back, middle, and front layers from the backup into single flattened images.
