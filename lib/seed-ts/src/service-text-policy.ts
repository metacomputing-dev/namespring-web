import { deepFreeze } from './utils/deep-freeze.js';

/**
 * Service-visible language policy shared by seed-ts display DTOs and spring-ts.
 * Raw authority/catalog records must remain untouched; sanitize only derived display values.
 */
export const SERVICE_TEXT_REPLACEMENTS = deepFreeze([
  ['파괴운', '분산 주의 흐름'],
  ['흉운수', '주의가 필요한 수리'],
  ['흩어지는 수', '에너지가 흩어지기 쉬운 수'],
  ['외로워지기 쉬운 수', '혼자 감당하는 느낌이 커지기 쉬운 수'],
  ['이별이 따르기 쉬운 수', '관계의 거리감에 신경 쓰면 좋은 수'],
  ['모든 것이 한곳에 모이기 어렵고 흩어지는 형상', '에너지가 여러 방향으로 흩어지기 쉬운 형상'],
  ['모든 것이 흩어지는 형상', '에너지가 여러 방향으로 흩어지기 쉬운 형상'],
  ['재물이 새어나가는 기운', '예상 밖 지출이 생기기 쉬운 흐름'],
  ['재물이 빠져나가는 기운', '예상 밖 지출이 생기기 쉬운 흐름'],
  ['예상 밖 지출이 생기기 쉬운 흐름이 따라 돈과 마음의 안정감을', '예상 밖 지출이 생기기 쉬워 돈과 마음의 안정감을'],
  ['경제적으로나 마음으로나 쉽게 안정되기 어려운 파동', '돈과 마음의 안정감을 꾸준히 관리할 필요가 있는 흐름'],
  ['돈과 마음의 안정감을 꾸준히 관리할 필요가 있는 흐름이 있어요', '돈과 마음의 안정감을 꾸준히 관리할 필요가 있어요'],
  ['특히 조심하면 좋을 점은', '미리 살펴보면 좋은 점은'],
  ['님은 미리 살펴보면 좋은 점은', '님이 미리 살펴보면 좋은 점은'],
  ['잦은 마찰이나 멀어짐', '작은 오해나 거리감'],
  ['충동적인 투자나 다른 사람의 보증, 무리한 사업 확장은 반드시 피하시고', '충동적인 투자, 보증, 무리한 확장은 되도록 피하고'],
  ['규칙적인 운동과 정기 건강 검진으로 몸과 마음의 균형을 유지하시길 권해 드려요', '규칙적인 운동과 충분한 휴식으로 생활 리듬을 안정적으로 유지해 보세요'],
  ['정기 건강 검진', '컨디션 점검'],
  ['건강 검진', '컨디션 점검'],
  ['정기 검진', '컨디션 점검'],
  ['건강검진', '컨디션 점검'],
  ['검진', '컨디션 점검'],
  ['의료기관 원장 및 병원 경영자', '전문 기관 책임자 및 운영자'],
  ['병원 경영자', '전문 기관 운영자'],
  ['심장이나 혈관, 신경 계통에 부담이 갈 수 있으니', '몸과 마음에 부담이 쌓일 수 있으니'],
  ['뇌 건강과 심장 및 혈관 관리에 각별히 신경 써 주세요', '몸과 마음에 쌓이는 피로 관리에 신경 써 주세요'],
  ['배와 장, 심장과 혈관 쪽 건강', '몸과 마음의 피로'],
  ['강철 같은 심장', '강철 같은 마음'],
  ['면역력', '회복력'],
  ['몸과 마음이 약해지기 쉬운 수리이니까 계절이 바뀌는 때와 스트레스가 많은 시기에 신경 관련 질환이나 만성피로를 특히 조심해야 해요', '몸과 마음의 피로가 쌓이기 쉬운 흐름이므로, 계절이 바뀌는 때와 스트레스가 많은 시기에는 생활 리듬과 충분한 휴식을 챙기면 좋아요'],
  ['건강이 나빠지거나', '생활 리듬이 흔들리거나'],
  ['몸이 약해지기 쉬운 기운', '생활 리듬이 흔들리기 쉬운 흐름'],
  ['몸이 약해지는 기운', '생활 리듬이 흔들리기 쉬운 흐름'],
  ['큰 병으로 이어질 수 있으니', '큰 피로로 이어질 수 있으니'],
  ['극단적인 선택을 하고 싶은 마음이 들기 쉬우니', '성급한 결정을 내리고 싶은 마음이 커질 수 있으니'],
  ['극단적인 선택은 절대 답이 아니며', '혼자 감당하지 말고 주변과 상황을 나누며'],
  ['질병', '건강 부담'],
  ['불안이나 우울로', '불안이나 마음의 침체로'],
  ['마음속 우울함', '마음의 침체'],
  ['우울하고 부정적인', '침체되고 부정적인'],
  ['우울함에 빠지지 않도록', '마음이 가라앉지 않도록'],
  ['깊은 우울로', '깊은 무기력으로'],
  ['성품마저 우울해지기 쉬워서', '마음이 가라앉기 쉬워서'],
  ['내면의 우울을', '내면의 침체를'],
  ['재앙', '큰 어려움'],
  ['심리치료, 사회복지, 의료봉사', '마음 돌봄, 사회복지, 봉사 활동'],
  ['심리치료', '마음 돌봄'],
  ['의료봉사', '봉사 활동'],
  ['건강 면에서도 특별히 신경을 써야 한다고', '건강 면에서도 기본 관리를 챙기면 좋다고'],
  ['가정환경이 불안정하거나 부모 형제와의 인연이 약한 흐름이 나타날 수 있어', '가정 안에서 변화나 거리감을 느낄 수 있어'],
  ['사람 관계가 끊어졌다 이어지기를 반복할 수 있는데', '사람 관계의 변화가 잦을 수 있는데'],
  ['경제적 오르내림과 가정 안에서의 갈등에 주의해야 하지만', '돈 관리와 가까운 사람과의 대화를 차분히 챙기면 좋고'],
  ["'어려움을 참고 견디면 반드시 뒤에 복이 온다'는 원리대로", '어려운 시기를 지나며 안정감을 만들어 갈 수 있다는 관점으로'],
  ["'어려움을 참고 견디면 반드시 뒤에 복이 온다'", "'어려운 시기를 지나며 뒤늦게 안정감을 만들 수 있다'"],
  ['어려움을 참고 견디면 반드시 뒤에 복이 온다', '어려운 시기를 지나며 뒤늦게 안정감을 만들 수 있다'],
  ['힘든 일을 참고 견디면 반드시 뒤에 복이 찾아온다는 뜻', '힘든 시기를 지나며 뒤늦게 안정감을 만들 수 있다는 뜻'],
  ['반드시 걱정할 필요 없이', '크게 걱정하기보다'],
  ['최고의 자리에 올라 큰 성공을 이루게 되는', '높은 수준의 성과를 만들 가능성이 큰'],
  ['최고의 자리에 오르는', '높은 수준의 성과를 향해 가는'],
  ['최고의 자리', '높은 수준의 자리'],
  ['높은 자리에 오르게 되는 흐름', '책임 있는 역할을 맡기 쉬운 흐름'],
  ['부와 명예를 동시에 손에 넣는', '성과와 인정을 함께 얻는'],
  ['반드시 좋은 결과를 맺는', '좋은 결과를 만들 가능성이 큰'],
  ['반드시 큰 일을 이루어 많은 사람들이 우러러보는 자리에 이르는, 정말 복된 수리예요', '큰 일을 이룰 가능성이 커서 주변의 인정을 받을 수 있는 수리예요'],
  ['반드시 뜻깊은 열매를 거두실 거예요', '뜻깊은 결실을 만들 수 있어요'],
  ['반드시 풍성한 결실을 맺을 수 있을 거예요', '풍성한 결실을 만들 수 있어요'],
  ['어떤 시련 앞에서도', '어려운 상황에서도'],
  ['시련기', '조정기'],
  ['시련', '어려움'],
  ['분산 주의 흐름의 무게', '흩어지는 흐름의 부담'],
  ['흩어지는 흐름의 부담를', '흩어지는 흐름의 부담을'],
  ['최상의 좋은 수', '매우 좋은 수'],
  ['이름을 널리 떨치고 풍요와 명예를 동시에 이루는', '성과와 인정을 함께 얻기 쉬운'],
  ['눈부신 성공', '뚜렷한 성과'],
  ['눈부신 성과', '뚜렷한 성과'],
  ['전성기를 맞이해요', '강점이 잘 드러나는 시기를 맞이해요'],
  ['사회적으로 이름을 알리게 되는 강점이 잘 드러나는 시기를 맞이해요', '주변에 실력을 알릴 기회가 커지는 시기를 맞이해요'],
  ['이름을 떨치는 황금기', '성과가 드러나기 쉬운 시기'],
  ['하늘을 찌르는 기상이 절정에 달하여', '강한 추진력과 자신감이 크게 드러나'],
  ['많은 사람들이 우러러보는 높은 자리에 오르고', '주변의 인정을 받는 역할을 맡고'],
  ['윗사람의 신뢰와 아랫사람의 충성을 함께 얻는 전성기예요', '윗사람과 동료의 신뢰를 함께 얻기 쉬운 시기예요'],
  ['존경받는 어른의 위치에서 풍요롭고 건강한 만년을 누리시며, 후대에 귀한 덕을 물려주시는 자리에 이르실 수 있어요', '주변에 좋은 영향을 주며 안정적인 노년을 보낼 가능성이 있어요'],
  ['이성 문제나 자만심을 경계하셔야 해요', '가까운 관계의 오해나 자만심을 주의하면 좋아요'],
  ['융창운의 좋은 흐름이 생애 전체에 고르게 펼쳐질 거예요', '융창운의 좋은 흐름이 더 안정적으로 이어질 수 있어요'],
  ['좋은 흐름이 생애 전체에 고르게 펼쳐질 거예요', '좋은 흐름이 더 안정적으로 이어질 수 있어요'],
  ['풍부운의 절정기로, 힘과 재물이 동시에 모여드는 인생의 황금기가 펼쳐져요', '풍부운이 강하게 드러나는 시기로, 성과와 경제적 여유가 함께 커지기 쉬워요'],
  ['사회적 이름값과 경제적 풍요를 동시에 누리실 수 있어요', '사회적 인정과 경제적 여유를 함께 느낄 수 있어요'],
  ['주변의 인정과 부를 동시에 얻는 황금기', '주변의 인정과 경제적 안정감을 함께 얻는 좋은 시기'],
  ['주변의 인정과 경제적 안정감을 함께 얻는 좋은 시기가 펼쳐지니', '주변의 인정과 경제적 안정감을 함께 키우기 좋은 흐름이 생기니'],
  ['이 시기를 놓치지 않도록 잘 준비하시길 권해 드려요', '이 흐름을 차분히 준비해 보세요'],
  ['깊은 존경과 편안한 노년을 누리실 수 있어요', '좋은 신뢰와 나중의 안정감을 준비해 갈 수 있어요'],
  ['좋은 신뢰와 안정적인 노년을 만들어 갈 수 있어요', '좋은 신뢰와 나중의 안정감을 준비해 갈 수 있어요'],
  ['기회가 물밀듯 찾아오는', '기회가 자주 들어오는'],
  ['사회에 나가자마자 빠른 속도로 두각을 나타내고', '사회생활 초반부터 두각을 나타내고'],
  ['중년기에 크게 이루기 위한', '중년기에 성과를 키우기 위한'],
  ['크게 번창하며', '안정적으로 성장하며'],
  ['힘과 재물을 동시에 손에 넣을 수 있는', '실행력과 경제적 성과가 함께 커지기 쉬운'],
  ['더할 나위 없이 좋은 수', '좋은 수'],
  ['오래오래 잘 사는 삶을 이루는', '오래 안정적으로 살아가는 데 도움이 되는'],
  ['오래오래 건강하게 사는 기운', '오래 이어 갈 안정감'],
  ['마른 나무에서 꽃이 피는 기운이 드디어 빛을 발하는 황금기', '오랫동안 쌓은 실력이 드러나는 좋은 시기'],
  ['세상에 인정받으며 이름과 존경을 얻게 되는 시기예요', '주변의 인정과 신뢰를 얻기 쉬운 시기예요'],
  ['기운의 흐름이 부딪히는 시기라면 결혼을 서두르기보다', '기운의 흐름이 부딪히는 시기라면 중요한 관계 결정을 서두르기보다'],
  ['보다 안정적인 가정을 꾸리시는 것이 좋아요', '보다 안정적인 관계의 기반을 만들면 좋아요'],
  ['아름다운 마무리가 기다리고 있으니', '좋은 마무리를 만들 수 있으니'],
  ['존경과 사랑을 받으시는', '좋은 평가를 받는'],
  ['아름다운 결실을 거두시길 진심으로 응원해요', '좋은 결실을 만들어 가세요'],
  ['밝은 기운과 함께하시길 진심으로 응원해요', '밝은 기운을 잘 이어가세요'],
  ['진심으로 응원해요', '차분히 이어가세요'],
  ['모든 일이 잘 풀리는 아름다운 인생', '일이 더 안정적으로 풀리는 흐름'],
  ['축복', '좋은 흐름'],
  ['하늘이 내린 복', '좋은 잠재력'],
  ['타고나셨어요', '보이는 편이에요'],
  ['타고나서', '갖고 있어서'],
  ['이 시기야말로 하나의 전문 분야를 정하고 꾸준히 실력을 쌓아가는 것이 훗날의 안정을 여는 열쇠예요', '이 시기에는 하나의 전문 분야를 정하고 꾸준히 실력을 쌓아 가면 훗날 안정의 기반이 돼요'],
  ['기초를 다져두시면, 그것이 나중에 평생의 자산이 된답니다', '기초를 다져 두면 나중에 평생의 자산이 돼요'],
  ['화려한 성공보다 실력을 묵묵히 쌓아가는 것이 중요하며', '화려한 성공보다 실력을 묵묵히 쌓아 가는 태도가 중요하고'],
  ['한 분야에 집중하시면 중년에 크게 꽃피울 토대가 만들어져요', '한 분야에 집중하면 중년에 실력이 크게 드러날 토대가 만들어져요'],
  ['꾸준히 실력을 쌓아가는', '꾸준히 실력을 쌓아 가는'],
  ['묵묵히 쌓아가는', '묵묵히 쌓아 가는'],
  ['기초를 다져두시면', '기초를 다져 두면'],
  ['집중하시면', '집중하면'],
  ['집중하시고', '집중하고'],
  ['준비하셔서', '준비해서'],
  ['주변의 주목을 받으시지만', '주변의 주목을 받지만'],
  ['답답함을 경험하실 수 있어요', '답답함을 경험할 수 있어요'],
  ['뚜렷한 성과을 거두시지만', '뚜렷한 성과를 거두지만'],
  ['돈 문제가 찾아올 수 있으며', '돈 문제가 찾아올 수 있고'],
  ['결정을 내리실 수 있게 되며', '결정을 내릴 수 있게 되고'],
  ['기반을 다지시는 데 집중하면', '기반을 다지는 데 집중하면'],
  ['기회를 만드실 수 있어요', '기회를 만들 수 있어요'],
  ['노후를 누리실 수 있어요', '후반기를 준비할 수 있어요'],
  ['노후를 누릴 수 있어요', '후반기를 준비할 수 있어요'],
  ['좋은 경험을 많이 쌓으시는 것이 좋아요', '좋은 경험을 많이 쌓으면 좋아요'],
  ['목표를 향해 달려가시게 되는데', '목표를 향해 달려가게 되는데'],
  ['사람 사이 갈등을 조심하시고', '사람 사이 갈등을 조심하고'],
  ['겸손함을 함께 실천하시면', '겸손함을 함께 실천하면'],
  ['사회적 인정을 받으실 수 있어요', '사회적 인정을 받을 수 있어요'],
  ['따뜻한 마음을 더하시면', '따뜻한 마음을 더하면'],
  ['넓은 시야를 키워두시면', '넓은 시야를 키워 두면'],
  ['실력을 먼저 쌓으시면', '실력을 먼저 쌓으면'],
  ['차근차근 기반을 다져 나가시게 되며', '차근차근 기반을 다져 나가게 되고'],
  ['직장에 들어가시면', '직장에 들어가면'],
  ['아래에서 출발하시더라도', '아래에서 출발하더라도'],
  ['동시에 얻으시게 되며', '동시에 얻게 되고'],
  ['보내실 수 있어요', '보낼 수 있어요'],
  ['느끼실 수 있어요', '느낄 수 있어요'],
  ['가꾸어 가시길 권해 드려요', '가꾸어 가면 좋아요'],
  ['후배나 후진', '후배나 다음 세대'],
  ['후배나 다음 세대을', '후배나 다음 세대를'],
  ['부귀와 명예', '성과와 인정'],
  ['자녀분들이', '자녀가'],
  ['겸손과 화합을 놓지 않으신다면', '겸손과 화합을 놓지 않으면'],
  ['좋은 흐름을 만들어 주는 좋은 운이에요', '좋은 흐름이에요'],
  ['건강하고 번창한다는 이름 그대로', '건강하고 활기찬 흐름처럼'],
  ['넉넉하고 오래오래 건강한 기운 그대로, ', '넉넉하고 건강한 흐름 속에서, '],
  ['건강하고 여유로운 노후를 보내시며', '건강하고 여유로운 노후를 보내며'],
  ['부자의 복이 온전히 열매를 맺어', '재물 안정의 흐름이 열매를 맺어'],
  ['23수 융창운의 기운이 본격적으로 꽃을 피우는 성과가 드러나기 쉬운 시기로', '23수 융창운의 기운이 본격적으로 드러나는 시기로'],
  ['똑똑한 머리와 남다른 담력', '빠른 이해력과 남다른 담력'],
  ['똑똑한 머리와 끈기 있는 적극적 행동', '빠른 이해력과 끈기 있는 행동'],
  ['똑똑한 머리', '빠른 이해력'],
  ['남다른 똑똑함과 활발한 기질', '빠른 이해력과 활발한 기질'],
  ['남다른 똑똑함', '빠른 이해력'],
  ['똑똑하고 재능이 빛나지만', '이해가 빠르고 재능이 빛나지만'],
  ['빠른 이해력와', '빠른 이해력과'],
  ['특유의 추진력과 머리로', '특유의 추진력과 판단력으로'],
  ['쌓아온 명성과 풍요', '쌓아 온 성과와 여유'],
  ['건강하고 활기찬 흐름처럼 건강하고 활기찬 노후를 보내실 수 있으니', '활기찬 후반기를 준비할 수 있으니'],
  ['건강하고 활기찬 노후를 보낼 수 있으니', '활기찬 후반기를 준비할 수 있으니'],
  ['노후를 보내실 수 있으니', '후반기를 준비할 수 있으니'],
  ['노후를 보낼 수 있으니', '후반기를 준비할 수 있으니'],
  ['넉넉하고 건강한 흐름 속에서, 건강하고 여유로운 노후를 보내며', '건강과 여유를 챙기며'],
  ['사회적 명성과 존경', '사회적 신뢰와 인정'],
  ['명성이 가장 높은 곳에 이르러', '성과가 크게 드러나'],
  ['재물 모으는 운이 본격적으로 꽃을 피우는 전성기', '재물 흐름이 또렷해지는 시기'],
  ['큰 재물과 사회적 명성', '경제적 안정과 사회적 인정'],
  ['자녀가 잘 되고 번창하며', '가족 안에서도 안정감이 커지며'],
  ['17수의 용감하게 나아가는 기운', '17수의 앞으로 나아가는 기운'],
  ['빠른 성공과 사회적 인정을', '빠른 성장과 사회적 인정을'],
  ['큰일을 이루고 많은 사람의 존경을 받는', '큰 성과를 만들고 주변의 인정을 받는'],
  ['복된 삶이 기다리고 있으니', '안정된 삶을 기대할 수 있으니'],
  ['마침내 열매를 맺어 마음의 풍요와 내면의 평화를 누릴 수 있으니', '시간이 지나며 안정감과 마음의 여유를 만들 수 있으니'],
  ['건강과 안정의 흐름이 무르익어서 건강과 재물, 평판이 고루 갖추어진', '몸과 마음이 안정되고 재물과 평판도 고르게 챙기는'],
  ['사람 복', '사람의 도움'],
  ['적은 노력으로도 많은 재물을 얻게 되는 부자 운', '성과를 효율적으로 키우는 흐름'],
  ['잘난 척하는 마음', '자기주장이 강하게 보이는 태도'],
  ['잘난 척과', '자기주장이 강하게 보이는 태도와'],
  ['잘난 척이나', '자기주장이 강하게 보이는 태도나'],
  ['잘난 척', '자기주장이 강하게 보이는 태도'],
  ['성공의 열매', '성과'],
  ['복과 오래 사는 기운', '건강과 안정의 흐름'],
  ['풍요로운 생활을 누리게 되며', '여유로운 생활을 기대할 수 있고'],
  ['주변 사람들한테', '주변 사람들에게'],
  ['존경받는 어른이자 좋은 선생님 같은 자리', '신뢰받는 조언자 같은 자리'],
  ['이름값', '평판'],
  ['받으시지만', '받지만'],
  ['경험하실 수 있어요', '경험할 수 있어요'],
  ['하실 수 있어요', '할 수 있어요'],
  ['하시고', '하고'],
  ['하시면', '하면'],
  ['하시되', '하되'],
] as const);

function escapeRegExpLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Most service strings contain none of the legacy rewrite literals. Testing
 * one compiled alternation avoids scanning the same string once per rule in
 * that common case. A positive match still runs the established ordered,
 * multi-pass loop unchanged so cascading replacements retain byte-for-byte
 * behavior.
 */
const SERVICE_TEXT_REPLACEMENT_TRIGGER = new RegExp(
  SERVICE_TEXT_REPLACEMENTS
    .map(([search]) => escapeRegExpLiteral(search))
    .join('|'),
  'u',
);

export function sanitizeServiceText(value: string, fullHangul: string): string {
  const displayName = fullHangul.trim() || '이름 주인공';
  let sanitized = value.replace(/\[성함\]/g, displayName);
  if (SERVICE_TEXT_REPLACEMENT_TRIGGER.test(sanitized)) {
    for (let pass = 0; pass < 3; pass += 1) {
      const before = sanitized;
      for (const [search, replacement] of SERVICE_TEXT_REPLACEMENTS) {
        sanitized = sanitized.replaceAll(search, replacement);
      }
      if (sanitized === before) break;
    }
  }
  sanitized = sanitized
    .replace(/([가-힣]+)님께서도/g, '$1님도')
    .replace(/([가-힣]+)님께서는/g, '$1님은')
    .replace(/([가-힣]+)님께서/g, '$1님은')
    .replace(/([가-힣]+)님은도/g, '$1님도')
    .replace(/([가-힣]+)님은 각/g, '$1님이 각')
    .replace(/([가-힣]+님) 한평생/g, '$1은 한평생')
    .replace(/성과와 인정를/g, '성과와 인정을')
    .replace(/성과을/g, '성과를')
    .replace(/뒷받침해주지/g, '뒷받침해 주지');
  return sanitized;
}

export function sanitizeServiceValue<T>(value: T, fullHangul: string): T {
  if (typeof value === 'string') {
    return sanitizeServiceText(value, fullHangul) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeServiceValue(item, fullHangul)) as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = sanitizeServiceValue(nested, fullHangul);
    }
    return out as T;
  }
  return value;
}

export function sanitizeImmutableServiceValue<T>(value: T, fullHangul: string): T {
  return deepFreeze(sanitizeServiceValue(value, fullHangul));
}

export type ServiceTextPolicySeverity = 'block' | 'review';

export interface ServiceTextPolicyRule {
  readonly id: string;
  readonly severity: ServiceTextPolicySeverity;
  readonly patternSource: string;
  readonly reason: string;
}

export interface ServiceTextPolicyViolation {
  readonly ruleId: string;
  readonly severity: ServiceTextPolicySeverity;
  readonly path: string;
  readonly match: string;
  readonly matchIndex: number;
  readonly context: string;
}

export interface ServiceTextPolicyAssertionOptions {
  readonly includeReview?: boolean;
  readonly rootPath?: string;
}

/**
 * Blocking rules cover medical or mental-health claims that must never reach a
 * service DTO. Review rules deliberately inventory broader authored-content
 * debt without applying unsafe word-wide rewrites.
 */
export const SERVICE_TEXT_POLICY_RULES: readonly ServiceTextPolicyRule[] = deepFreeze([
  {
    id: 'medical-checkup',
    severity: 'block',
    patternSource: '검진',
    reason: 'A name reading must not prescribe or predict medical checkups.',
  },
  {
    id: 'hospital',
    severity: 'block',
    patternSource: '병원',
    reason: 'Hospital-specific recommendations require authored review.',
  },
  {
    id: 'organ-specific-medical',
    severity: 'block',
    patternSource: '심장|혈관|뇌 건강|배와 장|면역력|신경 관련 질환|만성피로',
    reason: 'Organ-specific or diagnostic-sounding health claims are not supported.',
  },
  {
    id: 'disease-claim',
    severity: 'block',
    patternSource: '질병|건강이 나빠|몸이 약해|큰 병',
    reason: 'The display layer must not predict disease or physical weakness.',
  },
  {
    id: 'mental-health-label',
    severity: 'block',
    patternSource: '우울|극단적인 선택',
    reason: 'Mental-health labels and crisis language are unsafe in deterministic readings.',
  },
  {
    id: 'absolute-language',
    severity: 'review',
    patternSource: '반드시|무조건|절대|틀림없이',
    reason: 'Absolute wording needs sentence-level editorial review.',
  },
  {
    id: 'certainty-language',
    severity: 'review',
    patternSource: '확실|분명히',
    reason: 'Certainty claims need sentence-level editorial review.',
  },
  {
    id: 'lifetime-destiny',
    severity: 'review',
    patternSource: '평생|한평생|운명|타고나',
    reason: 'Lifetime and innate-destiny claims need authority review.',
  },
  {
    id: 'catastrophe-language',
    severity: 'review',
    patternSource: '재앙|재난|사고(?:가|를|의|로| 위험|성)',
    reason: 'Catastrophe or accident predictions need authored review.',
  },
  {
    id: 'medical-career',
    severity: 'review',
    patternSource: '의사(?=\\s|$)|전문의|의학|의료|치료',
    reason: 'Medical-career recommendations should not be rewritten without field context.',
  },
  {
    id: 'longevity-language',
    severity: 'review',
    patternSource: '장수|수명|오래 사',
    reason: 'Longevity claims need sentence-level authority review.',
  },
]);

function policyContext(value: string, index: number, matchLength: number): string {
  const start = Math.max(0, index - 40);
  const end = Math.min(value.length, index + matchLength + 40);
  return value.slice(start, end).replace(/\s+/gu, ' ').trim();
}

export function auditServiceTextPolicy(
  value: unknown,
  rootPath: string = 'value',
): readonly ServiceTextPolicyViolation[] {
  const violations: ServiceTextPolicyViolation[] = [];
  const seen = new WeakSet<object>();

  const visit = (nested: unknown, path: string): void => {
    if (typeof nested === 'string') {
      for (const rule of SERVICE_TEXT_POLICY_RULES) {
        const matcher = new RegExp(rule.patternSource, 'gu');
        for (const match of nested.matchAll(matcher)) {
          const matchIndex = match.index ?? 0;
          violations.push({
            ruleId: rule.id,
            severity: rule.severity,
            path,
            match: match[0],
            matchIndex,
            context: policyContext(nested, matchIndex, match[0].length),
          });
        }
      }
      return;
    }
    if (!nested || typeof nested !== 'object') return;
    if (seen.has(nested)) return;
    seen.add(nested);

    if (Array.isArray(nested)) {
      nested.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    for (const [key, item] of Object.entries(nested as Record<string, unknown>)) {
      visit(item, `${path}.${key}`);
    }
  };

  visit(value, rootPath);
  return deepFreeze(violations);
}

export class ServiceTextPolicyError extends Error {
  public readonly violations: readonly ServiceTextPolicyViolation[];

  public constructor(violations: readonly ServiceTextPolicyViolation[]) {
    const counts = new Map<string, number>();
    for (const violation of violations) {
      counts.set(violation.ruleId, (counts.get(violation.ruleId) ?? 0) + 1);
    }
    const summary = Array.from(counts.entries())
      .map(([ruleId, count]) => `${ruleId}=${count}`)
      .join(', ');
    super(`Service text policy rejected ${violations.length} occurrence(s): ${summary}`);
    this.name = 'ServiceTextPolicyError';
    this.violations = deepFreeze([...violations]);
  }
}

export function assertServiceTextPolicy(
  value: unknown,
  options: ServiceTextPolicyAssertionOptions = {},
): void {
  const violations = auditServiceTextPolicy(value, options.rootPath);
  const rejected = options.includeReview
    ? violations
    : violations.filter((violation) => violation.severity === 'block');
  if (rejected.length > 0) {
    throw new ServiceTextPolicyError(rejected);
  }
}
