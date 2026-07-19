export default function AccountScreen() {
  return (
    <main className="v3-page">
      <div className="v3-page-head">
        <p className="v3-kicker">계정</p>
        <h1 className="v3-page-title">내 계정</h1>
      </div>
      <div className="v3-card">
        <p style={{ margin: 0 }}>
          지금은 로그인 없이 모든 분석을 이 기기에서 바로 쓸 수 있어요.
        </p>
        <p style={{ margin: '0.6rem 0 0' }}>
          계정을 만들면 완성 리포트를 다시 열어 보고, 다른 기기에서도 이어 볼 수 있도록
          준비하고 있어요.
        </p>
      </div>
    </main>
  );
}
