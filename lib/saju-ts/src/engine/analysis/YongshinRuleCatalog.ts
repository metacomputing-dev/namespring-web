import { GyeokgukType } from '../../domain/Gyeokguk.js';
import { Ohaeng } from '../../domain/Ohaeng.js';


export enum SipseongCategory {
  BIGYEOP = 'BIGYEOP',
  SIKSANG = 'SIKSANG',
  JAE = 'JAE',
  GWAN = 'GWAN',
  INSEONG = 'INSEONG',
}


export interface GyeokgukYongshinRule {
  readonly primaryCategory: SipseongCategory;
  readonly secondaryCategory: SipseongCategory | null;
  readonly reasoning: string;
}

export const GYEOKGUK_YONGSHIN_TABLE: ReadonlyMap<GyeokgukType, GyeokgukYongshinRule> = new Map([
  [GyeokgukType.JEONGGWAN, {
    primaryCategory: SipseongCategory.JAE,
    secondaryCategory: SipseongCategory.INSEONG,
    reasoning: '순용: 재성이 관을 생하고(재생관), 인성이 관인상생으로 보호',
  }],
  [GyeokgukType.JEONGJAE, {
    primaryCategory: SipseongCategory.GWAN,
    secondaryCategory: SipseongCategory.SIKSANG,
    reasoning: '순용: 관성이 재를 보호(재생관), 식상이 재를 생(식상생재)',
  }],
  [GyeokgukType.PYEONJAE, {
    primaryCategory: SipseongCategory.GWAN,
    secondaryCategory: SipseongCategory.SIKSANG,
    reasoning: '순용: 관성이 재를 보호, 식상이 재를 생',
  }],
  [GyeokgukType.JEONGIN, {
    primaryCategory: SipseongCategory.GWAN,
    secondaryCategory: null,
    reasoning: '순용: 관성이 인을 생하여 관인상생으로 보호',
  }],
  [GyeokgukType.SIKSIN, {
    primaryCategory: SipseongCategory.JAE,
    secondaryCategory: SipseongCategory.BIGYEOP,
    reasoning: '순용: 재성이 식신의 힘을 이어받고(식신생재), 비겁이 식신을 보조',
  }],
  [GyeokgukType.GEONROK, {
    primaryCategory: SipseongCategory.GWAN,
    secondaryCategory: SipseongCategory.JAE,
    reasoning: '순용: 관성으로 비겁 과다를 제어, 재성으로 설기',
  }],
  [GyeokgukType.PYEONGWAN, {
    primaryCategory: SipseongCategory.SIKSANG,
    secondaryCategory: SipseongCategory.INSEONG,
    reasoning: '역용: 식신이 칠살을 제어(식신제살), 인성이 화살(化殺)',
  }],
  [GyeokgukType.SANGGWAN, {
    primaryCategory: SipseongCategory.INSEONG,
    secondaryCategory: SipseongCategory.JAE,
    reasoning: '역용: 인성이 상관을 제어(상관패인하렴), 재성으로 상관생재도 가능',
  }],
  [GyeokgukType.PYEONIN, {
    primaryCategory: SipseongCategory.JAE,
    secondaryCategory: null,
    reasoning: '역용: 편재가 편인을 제어하여 도식(倒食) 방지',
  }],
  [GyeokgukType.YANGIN, {
    primaryCategory: SipseongCategory.GWAN,
    secondaryCategory: null,
    reasoning: '역용: 관살이 양인을 제어(양인합살)',
  }],
]);


export const ILHAENG_TYPE_TO_OHAENG: ReadonlyMap<GyeokgukType, Ohaeng> = new Map([
  [GyeokgukType.GOKJIK, Ohaeng.WOOD],
  [GyeokgukType.YEOMSANG, Ohaeng.FIRE],
  [GyeokgukType.GASAEK, Ohaeng.EARTH],
  [GyeokgukType.JONGHYEOK, Ohaeng.METAL],
  [GyeokgukType.YUNHA, Ohaeng.WATER],
]);

