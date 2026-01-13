// Call the dataTables jQuery plugin
$(document).ready(function() {
  $('#dataTable').DataTable({
    columnDefs: [
      {
        targets: 9, // 1등 당첨금액(원)
        render: $.fn.dataTable.render.number(',', '.', 0)
      }
    ]
  });
});