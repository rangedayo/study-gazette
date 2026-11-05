/** @type {import('next').NextConfig} */
const nextConfig = {
  // 서식 변환을 처음 적용할 때 기존 노션 글의 캐시를 준비할 시간을 확보한다.
  staticPageGenerationTimeout: 180,
};
export default nextConfig;
