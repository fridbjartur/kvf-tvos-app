# TODO

## Future Enhancements

- [ ] **Marquee speed parity**: Add `marqueeSpeed` prop to `expo-tvos-search` native lib. Currently hardcoded at 30px/s in `MarqueeAnimationCalculator.swift:12`, while RN `MarqueeText` (`components/MarqueeText.tsx:21`) defaults to 60px/s. Wire prop through ExpoTvosSearchModule -> ExpoTvosSearchView -> SearchResultCard -> MarqueeAnimationCalculator.
