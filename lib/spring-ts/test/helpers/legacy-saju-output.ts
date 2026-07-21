/** Builds a real producer payload for adapter contract tests. saju-ts must be built first. */
export async function createLegacySajuOutputFixture(): Promise<Record<string, unknown>> {
  const modulePath = '../../../saju-ts/dist/index.js';
  const saju = await import(modulePath) as Record<string, any>;
  const birthInput = saju.createBirthInput({
    birthYear: 1986,
    birthMonth: 4,
    birthDay: 19,
    birthHour: 5,
    birthMinute: 45,
    gender: 'MALE',
    calendarType: 'SOLAR',
    timezone: 'Asia/Seoul',
    latitude: 37.5665,
    longitude: 126.978,
  });
  return saju.analyzeSaju(
    birthInput,
    saju.configFromPreset('KOREAN_MAINSTREAM'),
    {
      daeunCount: 2,
      saeunStartYear: 1986,
      saeunYearCount: 2,
      wolunStartYear: 1986,
      wolunMonthCount: 2,
    },
  ) as Record<string, unknown>;
}
