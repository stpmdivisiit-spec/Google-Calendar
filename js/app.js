/**
 * SIM PROKER FRONTEND LOGIC (ULTIMATE VERSION)
 */
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxb_eQbMQtpR3sS6IZiMLqcIzOjtzB2RZ9CSIDr6Yn9UHdTUw4XIw-nwsOIpXK8xLYucg/exec'; 

const app = {
    eventsData: [], table: null, tableExt: null, calendar: null,

    init: async function() {
        this.setupPlugins();
        this.setupDataTablesFilter();
        this.setupTemplateInteractions();
        
        await this.loadData();
        $('#app-loader').addClass('d-none'); $('#app-content').removeClass('d-none');
        
        this.initDataTables();
        this.initCalendar();
        DashboardAnalytics.init(this.eventsData);
    },

    setupPlugins: function() {
        $('.select2').select2({ theme: 'bootstrap-5', dropdownParent: $('#kegiatanModal') });
        $('.flatpickr-date').flatpickr({ enableTime: false, dateFormat: "Y-m-d" });
        $('.select2-filter').select2({ theme: 'bootstrap-5' });
        $('.flatpickr-range').flatpickr({ mode: "range", dateFormat: "Y-m-d", altInput: true, altFormat: "d M Y" });
    },

    setupDataTablesFilter: function() {
        $.fn.dataTable.ext.search.push((settings, data, dataIndex) => {
            const isExt = settings.nTable.id === 'dataTableExt';
            const currentTable = isExt ? this.tableExt : this.table;
            if (!currentTable) return true;

            const filterUnit = $(isExt ? '#filterUnitExt' : '#filterUnit').val();
            const filterDate = $(isExt ? '#filterDateExt' : '#filterDate').val(); 
            const rowData = currentTable.row(dataIndex).data(); 
            if (!rowData) return true;

            const unitMatch = filterUnit === "" || rowData.Unit === filterUnit;
            let dateMatch = true;
            if (filterDate) {
                const eventStart = new Date(rowData['Tanggal Mulai']).setHours(0,0,0,0);
                if (filterDate.includes(' to ')) {
                    const dates = filterDate.split(' to ');
                    dateMatch = (eventStart >= new Date(dates[0]).setHours(0,0,0,0) && eventStart <= new Date(dates[1]).setHours(23,59,59,999));
                } else dateMatch = (eventStart === new Date(filterDate).setHours(0,0,0,0));
            }
            return unitMatch && dateMatch;
        });
    },

    setupTemplateInteractions: function() {
        $('#tipe_kegiatan').on('change', function() {
            if ($(this).val() === 'Eksternal') { $('#wrap_deskripsi').removeClass('d-none'); } 
            else { $('#wrap_deskripsi').addClass('d-none'); }
        });

        $('#sidebarToggle').on('click', e => { e.preventDefault(); $('body').toggleClass('sb-sidenav-toggled'); });
        $('#themeToggle').on('click', function() { $('body').toggleClass('dark-mode'); $(this).html($('body').hasClass('dark-mode') ? '<i class="fas fa-sun"></i> Mode' : '<i class="fas fa-moon"></i> Mode'); });

        $('.menu-link').on('click', (e) => {
            e.preventDefault();
            $('.menu-link').removeClass('active'); $(e.currentTarget).addClass('active');
            $('.view-section').addClass('d-none');
            const target = $(e.currentTarget).data('target'); $(`#${target}`).removeClass('d-none');
            $('#page-title').text($(e.currentTarget).data('title') || $(e.currentTarget).text().trim());
            
            if (target === 'calendar-view' && this.calendar) setTimeout(() => this.calendar.render(), 100);
            else if (target === 'table-view') setTimeout(() => { if (this.table) this.table.columns.adjust().responsive.recalc(); if (this.tableExt) this.tableExt.columns.adjust().responsive.recalc(); }, 100);
        });

        const setupFilter = (unitId, dateId, tableObj, resetId) => {
            $(`#${unitId}, #${dateId}`).on('change', () => { if (tableObj) tableObj.draw(); });
            $(`#${resetId}`).on('click', () => { $(`#${unitId}`).val('').trigger('change'); document.querySelector(`#${dateId}`)._flatpickr.clear(); if (tableObj) tableObj.draw(); });
        };
        setupFilter('filterUnit', 'filterDate', this.table, 'btnResetFilter');
        setupFilter('filterUnitExt', 'filterDateExt', this.tableExt, 'btnResetFilterExt');

        $('#fileCsv').on('change', (e) => { const file = e.target.files[0]; if (!file) return; this.handleCsvUpload(file); $(e.target).val(''); });
        $('#kegiatanForm').on('submit', (e) => { e.preventDefault(); this.saveEvent(); });
    },

    loadData: async function() {
        try {
            const response = await fetch(GAS_WEB_APP_URL);
            const json = await response.json();
            this.eventsData = json.data || [];
        } catch (error) { this.toast('Gagal memuat data.', 'error'); }
    },

    refreshUI: function() {
        const dataInternal = this.eventsData.filter(d => d['Tipe Kegiatan'] !== 'Eksternal');
        const dataEksternal = this.eventsData.filter(d => d['Tipe Kegiatan'] === 'Eksternal');

        if (this.table) { this.table.clear(); this.table.rows.add(dataInternal); this.table.draw(); }
        if (this.tableExt) { this.tableExt.clear(); this.tableExt.rows.add(dataEksternal); this.tableExt.draw(); }
        if (this.calendar) { this.calendar.removeAllEvents(); this.calendar.addEventSource(this.formatEventsForCalendar(this.eventsData)); }
        
        DashboardAnalytics.populateCounters(this.eventsData);
        DashboardAnalytics.renderCharts(this.eventsData);
        DashboardAnalytics.detectConflicts(this.eventsData);
    },

    formatEventsForCalendar: function(data) {
        return data.map(item => {
            const start = new Date(item['Tanggal Mulai']); const end = new Date(item['Tanggal Selesai']);
            end.setDate(end.getDate() + 1);
            let isExt = item['Tipe Kegiatan'] === 'Eksternal';

            return {
                id: item['ID (UUID)'], title: (isExt ? '[EKSTERNAL] ' : '') + `[${item.Unit}] ${item['Program Kerja']}`,
                start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0], allDay: true,
                backgroundColor: isExt ? '#ffc107' : this.getUnitColorCode(item.Unit),
                borderColor: isExt ? '#ffc107' : this.getUnitColorCode(item.Unit),
                textColor: isExt ? '#000000' : '#ffffff', extendedProps: item
            };
        });
    },

    initDataTables: function() {
        const dInt = this.eventsData.filter(d => d['Tipe Kegiatan'] !== 'Eksternal');
        const dExt = this.eventsData.filter(d => d['Tipe Kegiatan'] === 'Eksternal');
        const dtDom = '<"row align-items-center mb-3"<"col-sm-12 col-md-6"B><"col-sm-12 col-md-6 d-flex justify-content-md-end"f>>rt<"row align-items-center mt-3"<"col-sm-12 col-md-5"i><"col-sm-12 col-md-7 d-flex justify-content-md-end"p>>';
        
        const getBtns = (isExt) => [
            { extend: 'copy', text: '<i class="fas fa-copy me-1"></i> Copy', className: isExt ? 'btn-purple mb-2' : 'btn btn-sm btn-outline-primary mb-2' },
            { extend: 'excel', text: '<i class="fas fa-file-excel me-1"></i> Excel', className: isExt ? 'btn-purple mb-2' : 'btn btn-sm btn-outline-success mb-2' },
            { extend: 'print', text: '<i class="fas fa-print me-1"></i> Print', className: isExt ? 'btn-purple mb-2' : 'btn btn-sm btn-outline-secondary mb-2' }
        ];

        const getCols = (isExt) => [
            { data: null, className: 'text-center', defaultContent: '', render: (d, t, r, meta) => meta.row + 1 },
            { data: 'Unit', defaultContent: '-', render: (d) => isExt ? `<span class="badge bg-warning text-dark">${d}</span>` : d },
            { data: 'Program Kerja', className: 'fw-bold text-dark', defaultContent: '-' },
            { data: 'Waktu (Teks)', defaultContent: '-' },
            { data: 'PIC', defaultContent: '-' },
            { data: 'ID (UUID)', className: 'text-center', defaultContent: '',
              render: id => `<div class="d-flex justify-content-center gap-2">
                  <button class="btn btn-sm btn-info btn-icon text-white" onclick="app.viewDetail('${id}')" title="Detail"><i class="fas fa-eye"></i></button>
                  <button class="btn btn-sm btn-primary btn-icon" onclick="app.editEvent('${id}')" title="Edit"><i class="fas fa-edit"></i></button>
                  <button class="btn btn-sm btn-danger btn-icon" onclick="app.deleteEvent('${id}')" title="Hapus"><i class="fas fa-trash-alt"></i></button></div>`
            }
        ];

        if ($.fn.DataTable.isDataTable('#dataTable')) $('#dataTable').DataTable().destroy();
        if ($.fn.DataTable.isDataTable('#dataTableExt')) $('#dataTableExt').DataTable().destroy();

        this.table = $('#dataTable').DataTable({ data: dInt, responsive: true, scrollX: true, dom: dtDom, columns: getCols(false), buttons: getBtns(false) });
        this.tableExt = $('#dataTableExt').DataTable({ data: dExt, responsive: true, scrollX: true, dom: dtDom, columns: getCols(true), buttons: getBtns(true) });
    },

    initCalendar: function() {
        this.calendar = new FullCalendar.Calendar(document.getElementById('calendar'), {
            initialView: 'dayGridMonth', firstDay: 0, 
            headerToolbar: { left: 'today prev,next', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' },
            events: this.formatEventsForCalendar(this.eventsData), editable: true, droppable: true, selectable: true, dayMaxEvents: true,
            dateClick: (i) => { this.openModal(); $('#tanggal_mulai').val(i.dateStr); },
            eventClick: (i) => { this.viewDetail(i.event.id); },
            eventDrop: (i) => { this.syncDragDrop(i.event); }, eventResize: (i) => { this.syncDragDrop(i.event); }
        });
    },

    getUnitColorCode: function(unit) {
        const colors = {
            'Akademik dan Kerja Sama': '#0d6efd', 'Non Akademik dan Kemahasiswaan': '#dc3545', 'Lembaga Penjaminan Mutu (LPM)': '#6f42c1', 'LP2M': '#198754',
            'Program Studi Pembangunan Sosial': '#0dcaf0', 'Program Studi Ilmu Pemerintahan': '#fd7e14', 'Sekretariat': '#ffc107', 'Unit Pangkalan Data & IT': '#20c997',
            'Campus Ministry': '#e83e8c', 'Penerimaan Mahasiswa Baru (PMB)': '#6610f2', 'UPT Perpustakaan': '#d63384'
        }; return colors[unit] || '#6c757d';
    },

    viewDetail: function(id) {
        const item = this.eventsData.find(d => d['ID (UUID)'] === id);
        if (!item) return;
        $('#detTipe').text(item['Tipe Kegiatan'] === 'Eksternal' ? 'Eksternal / Luar Kampus' : 'Internal STPM');
        $('#detProgram').text(item['Program Kerja']); $('#detUnit').text(item.Unit); $('#detWaktu').text(item['Waktu (Teks)'] || '-');
        $('#detTempat').text(item.Tempat || '-'); $('#detPic').text(item.PIC); $('#detTarget').text(item['Target/Sasaran'] || '-');
        $('#detAspek').text(item.Aspek || '-'); $('#detAnggaran').text(item.Anggaran || '-'); $('#detTujuan').text(item.Tujuan || '-');
        $('#detDetail').text(item['Detail Kegiatan'] || '-'); $('#detOutput').text(item.Output || '-'); $('#detDampak').text(item.Dampak || '-');
        $('#detailModal').modal('show');
    },

    openModal: function() {
        $('#kegiatanForm')[0].reset(); $('#event_id').val('');
        $('#tipe_kegiatan').val('Internal').trigger('change'); $('.select2').val('').trigger('change');
        $('#kegiatanModal').modal('show');
    },

    editEvent: function(id) {
        const item = this.eventsData.find(d => d['ID (UUID)'] === id);
        if (!item) return;
        $('#event_id').val(item['ID (UUID)']); $('#tipe_kegiatan').val(item['Tipe Kegiatan'] || 'Internal').trigger('change'); 
        $('#unit').val(item.Unit).trigger('change'); $('#aspek').val(item.Aspek); $('#program_kerja').val(item['Program Kerja']);
        $('#tujuan').val(item.Tujuan); $('#detail_kegiatan').val(item['Detail Kegiatan']); $('#waktu_teks').val(item['Waktu (Teks)']);
        $('#tanggal_mulai').val(new Date(item['Tanggal Mulai']).toISOString().split('T')[0]);
        $('#tanggal_selesai').val(new Date(item['Tanggal Selesai']).toISOString().split('T')[0]);
        $('#tempat').val(item.Tempat); $('#pic').val(item.PIC).trigger('change'); $('#target_sasaran').val(item['Target/Sasaran']);
        $('#anggaran').val(item.Anggaran); $('#output').val(item.Output); $('#dampak').val(item.Dampak);
        $('#kegiatanModal').modal('show');
    },

    saveEvent: function() {
        const payload = {
            id: $('#event_id').val(), tipe: $('#tipe_kegiatan').val(), unit: $('#unit').val(), aspek: $('#aspek').val(),
            program_kerja: $('#program_kerja').val(), tujuan: $('#tujuan').val(), detail_kegiatan: $('#detail_kegiatan').val(), 
            waktu_teks: $('#waktu_teks').val(), tanggal_mulai: $('#tanggal_mulai').val(), tanggal_selesai: $('#tanggal_selesai').val(),
            tempat: $('#tempat').val(), pic: $('#pic').val(), target_sasaran: $('#target_sasaran').val(),
            anggaran: $('#anggaran').val(), output: $('#output').val(), dampak: $('#dampak').val()
        };

        const action = payload.id ? 'update' : 'add';
        const newStart = new Date(payload.tanggal_mulai).getTime(); const newEnd = new Date(payload.tanggal_selesai).getTime();
        let conflicts = [];

        this.eventsData.forEach(ev => {
            if (payload.id && ev['ID (UUID)'] === payload.id) return;
            const eStart = new Date(ev['Tanggal Mulai']).getTime(); const eEnd = new Date(ev['Tanggal Selesai']).getTime();
            if (!isNaN(eStart) && !isNaN(eEnd) && !isNaN(newStart) && !isNaN(newEnd)) {
                if (newStart <= eEnd && eStart <= newEnd) conflicts.push(`• <b>${ev['Program Kerja']}</b> <span class="text-primary">(${ev.Unit})</span>`);
            }
        });

        if (conflicts.length > 0) {
            Swal.fire({
                title: '⚠️ Tabrakan Jadwal',
                html: `<div class="text-start mb-2">Berbenturan dengan kegiatan berikut:</div><div class="text-start bg-light p-2 rounded mb-3" style="max-height: 120px; overflow-y: auto; font-size: 0.9rem;">${conflicts.join('<br>')}</div><div class="text-start">Apakah yakin tetap menyimpan?</div>`,
                icon: 'warning', showCancelButton: true, confirmButtonColor: '#0d6efd', cancelButtonColor: '#6c757d', confirmButtonText: 'Ya, Simpan'
            }).then(r => { if (r.isConfirmed) this.executeSaveToServer(action, payload, $('#btnSave')); });
        } else this.executeSaveToServer(action, payload, $('#btnSave'));
    },

    executeSaveToServer: async function(action, payload, btn) {
        btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-1"></i> Memproses...');
        try {
            const res = await fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action: action, payload: payload }) });
            const data = await res.json();
            if (data.status === 'success') { this.toast('Tersimpan!', 'success'); $('#kegiatanModal').modal('hide'); await this.loadData(); this.refreshUI(); } 
            else throw new Error(data.message);
        } catch (err) { this.toast(err.message, 'error'); } finally { btn.prop('disabled', false).text('Simpan Program Kerja'); }
    },

    deleteEvent: function(id) {
        Swal.fire({ title: 'Hapus?', text: "Hapus juga dari G-Calendar?", icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc3545', confirmButtonText: 'Ya, hapus!'})
        .then(async r => {
            if (r.isConfirmed) {
                try {
                    const res = await (await fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action: 'delete', id: id }) })).json();
                    if(res.status === 'success') { this.toast('Terhapus.', 'success'); await this.loadData(); this.refreshUI(); }
                } catch (e) { this.toast('Gagal menghapus.', 'error'); }
            }
        });
    },

    syncDragDrop: function(event) {
        const it = event.extendedProps;
        const payload = {
            id: it['ID (UUID)'], tipe: it['Tipe Kegiatan'] || 'Internal', unit: it.Unit, aspek: it.Aspek, program_kerja: it['Program Kerja'], 
            tujuan: it.Tujuan, detail_kegiatan: it['Detail Kegiatan'], waktu_teks: it['Waktu (Teks)'],
            tanggal_mulai: event.start.toISOString().split('T')[0],
            tanggal_selesai: event.end ? new Date(event.end.getTime() - 86400000).toISOString().split('T')[0] : event.start.toISOString().split('T')[0],
            tempat: it.Tempat, pic: it.PIC, target_sasaran: it['Target/Sasaran'], anggaran: it.Anggaran, output: it.Output, dampak: it.Dampak
        };
        fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action: 'update', payload: payload }) })
        .then(res => res.json()).then(() => { this.toast('Waktu ditarik', 'info'); this.loadData().then(() => this.refreshUI()); });
    },

    handleCsvUpload: function(file) {
        if (typeof Papa === 'undefined') return this.toast('Library CSV belum termuat.', 'error');
        Papa.parse(file, {
            header: true, skipEmptyLines: true,
            complete: async (res) => {
                if (res.data.length === 0) return this.toast('File CSV kosong', 'warning');
                const req = ['Tipe Kegiatan', 'Unit', 'Program Kerja', 'Tanggal Mulai', 'Tanggal Selesai', 'PIC'];
                const hds = Object.keys(res.data[0]);
                if (!req.every(h => hds.includes(h))) return Swal.fire('Format Salah', `Header wajib: ${req.join(', ')}`, 'error');
                this.processBulkImport(res.data);
            }
        });
    },

    processBulkImport: async function(dataList) {
        const total = dataList.length; let success = 0, err = 0;
        Swal.fire({ title: 'Mengimpor Matriks...', html: `<div class="mb-3">Sinkronisasi Google Calendar...</div><div class="progress" style="height: 25px;"><div id="import-progress" class="progress-bar progress-bar-striped progress-bar-animated bg-primary" style="width: 0%;">0%</div></div><div class="mt-2 small text-muted" id="import-status">Proses 0 dari ${total}</div>`, allowOutsideClick: false, allowEscapeKey: false, showConfirmButton: false });

        for (let i = 0; i < total; i++) {
            const row = dataList[i];
            const payload = {
                id: "", tipe: row['Tipe Kegiatan'] === 'Eksternal' ? 'Eksternal' : 'Internal', unit: row['Unit'], aspek: row['Aspek'] || '-', program_kerja: row['Program Kerja'], 
                tujuan: row['Tujuan'] || '-', detail_kegiatan: row['Detail Kegiatan'] || '-', waktu_teks: row['Waktu (Teks)'] || '-', tanggal_mulai: row['Tanggal Mulai'], tanggal_selesai: row['Tanggal Selesai'], 
                tempat: row['Tempat'] || '-', pic: row['PIC'], target_sasaran: row['Target/Sasaran'] || '-', anggaran: row['Anggaran'] || '-', output: row['Output'] || '-', dampak: row['Dampak'] || '-'
            };
            try {
                const res = await (await fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action: 'add', payload: payload }) })).json();
                if (res.status === 'success') success++; else err++;
            } catch (e) { err++; }
            const pct = Math.round(((i + 1) / total) * 100);
            $('#import-progress').css('width', pct + '%').text(pct + '%'); $('#import-status').text(`Proses ${i + 1} dari ${total}`);
        }
        Swal.fire({ title: 'Selesai!', html: `Berhasil: <b>${success}</b><br>Gagal: <b>${err}</b>`, icon: err > 0 ? 'warning' : 'success', confirmButtonText: 'Selesai' }).then(() => { this.loadData().then(() => this.refreshUI()); });
    },

    toast: function(message, icon) { Swal.fire({ title: message, icon: icon, toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 }); }
};

$(document).ready(() => app.init());