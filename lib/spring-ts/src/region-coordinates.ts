export interface RegionCoordinate {
  code: string;
  latitude: number;
  longitude: number;
  timezone: string;
  aliases: string[];
}

export const KOREA_REGION_COORDINATES: ReadonlyArray<RegionCoordinate> = [
  {
    code: 'SEOUL',
    latitude: 37.5665,
    longitude: 126.9780,
    timezone: 'Asia/Seoul',
    aliases: ['서울'],
  },
  {
    code: 'BUSAN',
    latitude: 35.1796,
    longitude: 129.0756,
    timezone: 'Asia/Seoul',
    aliases: ['부산'],
  },
  {
    code: 'DAEGU',
    latitude: 35.8714,
    longitude: 128.6014,
    timezone: 'Asia/Seoul',
    aliases: ['대구'],
  },
  {
    code: 'INCHEON',
    latitude: 37.4563,
    longitude: 126.7052,
    timezone: 'Asia/Seoul',
    aliases: ['인천'],
  },
  {
    code: 'GWANGJU',
    latitude: 35.1595,
    longitude: 126.8526,
    timezone: 'Asia/Seoul',
    aliases: ['광주'],
  },
  {
    code: 'DAEJEON',
    latitude: 36.3504,
    longitude: 127.3845,
    timezone: 'Asia/Seoul',
    aliases: ['대전'],
  },
  {
    code: 'ULSAN',
    latitude: 35.5384,
    longitude: 129.3114,
    timezone: 'Asia/Seoul',
    aliases: ['울산'],
  },
  {
    code: 'SEJONG',
    latitude: 36.4801,
    longitude: 127.2890,
    timezone: 'Asia/Seoul',
    aliases: ['세종'],
  },
  {
    code: 'GYEONGGI',
    latitude: 37.2636,
    longitude: 127.0286,
    timezone: 'Asia/Seoul',
    aliases: ['경기'],
  },
  {
    code: 'GANGWON',
    latitude: 37.8813,
    longitude: 127.7298,
    timezone: 'Asia/Seoul',
    aliases: ['강원'],
  },
  {
    code: 'CHUNGBUK',
    latitude: 36.6424,
    longitude: 127.4890,
    timezone: 'Asia/Seoul',
    aliases: ['충북'],
  },
  {
    code: 'CHUNGNAM',
    latitude: 36.6588,
    longitude: 126.6728,
    timezone: 'Asia/Seoul',
    aliases: ['충남'],
  },
  {
    code: 'JEONBUK',
    latitude: 35.8242,
    longitude: 127.1479,
    timezone: 'Asia/Seoul',
    aliases: ['전북'],
  },
  {
    code: 'JEONNAM',
    latitude: 34.9906,
    longitude: 126.4817,
    timezone: 'Asia/Seoul',
    aliases: ['전남'],
  },
  {
    code: 'GYEONGBUK',
    latitude: 36.5684,
    longitude: 128.7294,
    timezone: 'Asia/Seoul',
    aliases: ['경북'],
  },
  {
    code: 'GYEONGNAM',
    latitude: 35.2279,
    longitude: 128.6811,
    timezone: 'Asia/Seoul',
    aliases: ['경남'],
  },
  {
    code: 'JEJU',
    latitude: 33.4996,
    longitude: 126.5312,
    timezone: 'Asia/Seoul',
    aliases: ['제주'],
  },
];

export const KOREA_REGION_PRIMARY_ALIASES: ReadonlyArray<string> = KOREA_REGION_COORDINATES
  .map((region) => String(region.aliases?.[0] ?? '').trim())
  .filter((alias) => alias.length > 0);
