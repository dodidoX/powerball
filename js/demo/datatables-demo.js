// Call the dataTables jQuery plugin
$(document).ready(function () {

  if (!$("#dataTable").length) return;
  if ($.fn.DataTable.isDataTable("#dataTable")) return; // 중복 초기화 방지

  const $tableEl = $("#dataTable");
  const tableEl = $tableEl.get(0);

  // 테이블을 감싸는 실제 폭 기준(진짜 표가 좁아질 때만 동작)
  const wrapperEl = tableEl.closest(".table-responsive") || tableEl.parentElement;

  // 버튼은 "상시 존재"가 전제 (HTML에서 d-sm-none 제거)
  const $btn = $("#toggleExtraCols");

  // 0-based column indexes
  const EXTRA_COLS = [10,11,12,13,14,15,16,17,18];

  // 상태 변수
  let extrasShown = false;  // 좁은 모드에서 "상세 열 펼침" 상태
  let NARROW = false;       // 현재 "표가 좁은" 상태인지
  let lastNarrow = null;

  // ✅ 여기만 조절하면 됨: "좁다" 판단 기준 폭 (wrapper 기준)
  // 너무 일찍 숨겨지면 숫자를 줄이고, 너무 늦게 숨겨지면 숫자를 늘리기
  const COMPACT_WIDTH = 860;

  function isNarrowByWrapperWidth(){
    const w = wrapperEl ? wrapperEl.clientWidth : window.innerWidth;
    return w <= COMPACT_WIDTH;
  }

  function setToggleButtonState(){
    if (!$btn.length) return;

    if (!NARROW){
      // 넓은 상태: 상세열 항상 표시, 버튼은 존재하되 비활성
      $btn.prop("disabled", true);
      $btn.text("상세 열(넓은 화면에서는 항상 표시)");
      $btn.removeClass("btn-primary").addClass("btn-outline-secondary");
    } else {
      // 좁은 상태: 버튼 활성
      $btn.prop("disabled", false);
      $btn.text(extrasShown ? "상세 열 접기" : "상세 열 펼치기");
      $btn.removeClass("btn-primary").addClass("btn-outline-secondary");
    }
  }

  function applyResponsiveColumns(dt){
    NARROW = isNarrowByWrapperWidth();

    // 모드 전환 시 기본 상태 정리
    if (lastNarrow === null || NARROW !== lastNarrow){
      if (NARROW){
        // 좁은 모드로 진입: 기본은 상세 열 숨김
        extrasShown = false;
      } else {
        // 넓은 모드: 상세 열 항상 표시
        extrasShown = true;
      }
      lastNarrow = NARROW;
    }

    // 열 표시/숨김 적용
    if (!NARROW){
      EXTRA_COLS.forEach(i => dt.column(i).visible(true, false));
    } else {
      EXTRA_COLS.forEach(i => dt.column(i).visible(extrasShown, false));
    }

    // 금액 표시(render)도 NARROW에 따라 달라지므로 redraw
    dt.columns.adjust().draw(false);

    // 버튼 상태 동기화
    setToggleButtonState();
  }

  // ✅ DataTable 생성
  const dt = $tableEl.DataTable({
    paging: true,
    pageLength: 25,
    searching: true,
    info: false,
    autoWidth: false,

    // ✅ 네 기존 옵션 유지: 첫 번째 열 내림차순
    order: [[0, "desc"]],

    columnDefs: [
      {
        targets: 9, // 1등 당첨금액(원)
        render: function (data, type) {
          const raw = (data ?? "").toString().replace(/,/g, "");
          const v = parseInt(raw, 10);

          // 정렬/필터링/타입판정은 숫자 원값 반환
          if (type === "sort" || type === "type" || type === "filter") {
            return isNaN(v) ? 0 : v;
          }

          // display만: 표가 좁으면 억 단위, 아니면 원 단위
          if (!isNaN(v)) {
            if (NARROW) return (v / 1e8).toFixed(1) + "억";
            return v.toLocaleString("ko-KR");
          }
          return data;
        }
      }
    ]
  });

  // ✅ 최초 적용
  lastNarrow = null;
  applyResponsiveColumns(dt);

  // ✅ 버튼 클릭: 좁은 모드에서만 동작
  if ($btn.length){
    $btn.on("click", function () {
      if (!NARROW) return;
      extrasShown = !extrasShown;
      applyResponsiveColumns(dt);
    });
  }

  // ✅ wrapper 폭 변화를 관찰 (진짜 표가 좁아질 때만 반응)
  if (window.ResizeObserver && wrapperEl){
    const ro = new ResizeObserver(() => {
      applyResponsiveColumns(dt);
    });
    ro.observe(wrapperEl);
  } else {
    // 구형 브라우저 fallback
    let t = null;
    window.addEventListener("resize", function(){
      clearTimeout(t);
      t = setTimeout(() => applyResponsiveColumns(dt), 80);
    });
  }

});