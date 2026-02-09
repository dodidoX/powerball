// Call the dataTables jQuery plugin
$(document).ready(function () {

  const isMobile = window.matchMedia("(max-width: 576px)").matches;

  $('#dataTable').DataTable({
    paging: true,
    pageLength: 25,
    searching: false,
    info: false,
    autoWidth: false,

    // 1️⃣ 컬럼별 처리
    columnDefs: [
      // 1등 당첨금액(원) → 천단위 콤마
      {
        targets: 9,
        render: $.fn.dataTable.render.number(',', '.', 0)
      },

      // 📱 모바일에서는 중요도 낮은 컬럼 숨김
      ...(isMobile ? [{
        targets: [10,11,12,13,14,15,16,17,18],
        visible: false
      }] : [])
    ]
  });

});
