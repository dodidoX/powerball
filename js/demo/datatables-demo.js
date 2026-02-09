// Call the dataTables jQuery plugin
$(document).ready(function () {

  if (!$("#dataTable").length) return;
  if ($.fn.DataTable.isDataTable("#dataTable")) return; // 중복 초기화 방지

  const isMobile = window.matchMedia("(max-width: 576px)").matches;

  const table = $("#dataTable").DataTable({
    paging: true,
    pageLength: 25,
    searching: true,
    info: false,
    autoWidth: false,
    columnDefs: [
      {
        targets: 9, // 1등 당첨금액(원)
        render: function (data, type) {
          const raw = (data ?? "").toString().replace(/,/g, "");
          const v = parseInt(raw, 10);

          // 정렬/필터링/타입판정은 "숫자 원값" 반환 (정렬 깨짐 방지)
          if (type === "sort" || type === "type" || type === "filter") {
            return isNaN(v) ? 0 : v;
          }

          // 화면 표시(display)만 보기 좋게
          if (!isNaN(v)) {
            if (isMobile) return (v / 1e8).toFixed(1) + "억";
            return v.toLocaleString("ko-KR");
          }

          return data;
        }
      },
      ...(isMobile ? [{
        targets: [10,11,12,13,14,15,16,17,18],
        visible: false
      }] : [])
    ]
  });

  // 📱 모바일 전용: 상세 열 토글
  if (isMobile && $("#toggleExtraCols").length) {
    let extrasShown = false;

    $("#toggleExtraCols").on("click", function () {
      extrasShown = !extrasShown;

      const targets = [10,11,12,13,14,15,16,17,18];
      targets.forEach(i => table.column(i).visible(extrasShown));

      $(this).text(extrasShown ? "상세 열 접기" : "상세 열 펼치기");
      table.columns.adjust().draw(false);
    });
  }

});
