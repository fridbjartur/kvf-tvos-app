export type LiveQuality = {
  id: string;
  label: string;
  bitrate?: string;
  streamUrl: string;
};

export type LiveChannel = {
  id: string;
  title: string;
  qualities: LiveQuality[];
};

export const liveChannels: LiveChannel[] = [
  {
    id: "kvf",
    title: "KVF",
    qualities: [
      {
        id: "auto",
        label: "Sjálvvirkur",
        streamUrl:
          "https://play.kringvarp.fo/redirect/kvf/_definst_/smil:kvf.smil?type=m3u8",
      },
      {
        id: "1080_high",
        label: "1080p",
        bitrate: "8 Mb/s",
        streamUrl:
          "https://play.kringvarp.fo/redirect/kvf/_definst_/1080_high.stream?type=m3u8",
      },
      {
        id: "1080",
        label: "1080p",
        bitrate: "6 Mb/s",
        streamUrl:
          "https://play.kringvarp.fo/redirect/kvf/_definst_/1080.stream?type=m3u8",
      },
      {
        id: "720",
        label: "720p",
        bitrate: "4 Mb/s",
        streamUrl:
          "https://play.kringvarp.fo/redirect/kvf/_definst_/720.stream?type=m3u8",
      },
      {
        id: "480",
        label: "480p",
        bitrate: "1.2 Mb/s",
        streamUrl:
          "https://play.kringvarp.fo/redirect/kvf/_definst_/480.stream?type=m3u8",
      },
      {
        id: "360",
        label: "360p",
        bitrate: "800 kb/s",
        streamUrl:
          "https://play.kringvarp.fo/redirect/kvf/_definst_/360.stream?type=m3u8",
      },
      {
        id: "252",
        label: "252p",
        bitrate: "400 kb/s",
        streamUrl:
          "https://play.kringvarp.fo/redirect/kvf/_definst_/240.stream?type=m3u8",
      },
    ],
  },
  {
    id: "kvf2",
    title: "KVF 2",
    qualities: [
      {
        id: "default",
        label: "Sjálvvirkur",
        streamUrl:
          "https://w-live-edge1.kringvarp.fo/kvf/_definst_/1080_high.stream/playlist.m3u8",
      },
    ],
  },
];
