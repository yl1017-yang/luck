# 사주 후보 검증용 배포 파일

이 폴더는 후보 비교 테스트용이며 사이트 HTML/JS에서 불러오지 않는다. 브라우저 실행용 파일로 승격할 때는 별도로 검토한다. 버전을 고정하고 원본 MIT LICENSE를 각 하위 폴더에 보관한다.

| 후보 | 배포 파일 | SHA-256 |
| --- | --- | --- |
| lunar-javascript 1.7.7 | lunar-javascript/lunar.cjs | 9750324BFE1AA63C146F8C72B1143DF924466C11C8A5277D7D9225C541A18AAA |
| @fullstackfamily/manseryeok 1.0.8 | manseryeok/index.cjs | CEC2264B72C463351BB9FDBB0EFDC98310D272E43F89FE2CE8263137DF900817 |

다운로드일: 2026-10-15. 원본을 수정하지 않고 Node.js 비교 테스트를 위해 확장자만 .cjs로 저장했다.

출처:

- https://cdn.jsdelivr.net/npm/lunar-javascript@1.7.7/lunar.js
- https://cdn.jsdelivr.net/npm/lunar-javascript@1.7.7/LICENSE
- https://cdn.jsdelivr.net/npm/@fullstackfamily/manseryeok@1.0.8/dist/index.js
- https://raw.githubusercontent.com/urstory/manseryeok-js/main/LICENSE

manseryeok 라이선스는 패키지 CDN 요청 지연으로 공식 저장소에서 확보했다. 배포 파일 안의 소스맵과 검증에 불필요한 부속 파일은 포함하지 않았다.
