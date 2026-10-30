import { browser } from 'wxt/browser';

const REPO_URL = 'https://github.com/firevenus/TabPocket';
const ISSUES_URL = 'https://github.com/firevenus/TabPocket/issues';

export default function AboutView() {
  const version = browser.runtime.getManifest().version;

  return (
    <div className="about-view">
      <div className="about-logo">TP</div>
      <h2 className="about-name">TabPocket · 页袋</h2>
      <p className="about-slogan">把网页收进口袋，需要时再掏出来。</p>

      <p className="about-desc">
        标签收拢 · 收藏整理 · 待看 · 浏览统计，四合一浏览器扩展。
        <br />
        Manifest V3，数据 100% 本地，无需账号，没有广告。
      </p>

      <div className="about-version">版本 v{version}</div>

      <a className="about-link" href={REPO_URL} target="_blank" rel="noreferrer">
        GitHub 仓库
      </a>

      <p className="about-invite">
        觉得少了什么功能？或有什么好点子？欢迎到 GitHub Issues 提建议，我都会看：
      </p>
      <a className="about-link" href={ISSUES_URL} target="_blank" rel="noreferrer">
        提建议 / Issues
      </a>

      <p className="about-foot">MIT License · © 2026 Enki Yan (firevenus)</p>
    </div>
  );
}
