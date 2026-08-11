const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxb_eQbMQtpR3sS6IZiMLqcIzOjtzB2RZ9CSIDr6Yn9UHdTUw4XIw-nwsOIpXK8xLYucg/exec'; 

const app = {
    eventsData: [],
    table: null,
    tableExt: null,
    calendar: null,

    init: async function() {
        this.setupPlugins();
        this.setupDataTablesFilter();
        this.setupTemplateInteractions();
        
        await this.loadData();
        
        $('#app-loader').addClass('d-none');
        $('#app-content').removeClass('d-none');
        
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
            const currentTable = settings.nTable.id === 'dataTable' ? this.table : this.tableExt;
            if (!currentTable) return true;

            const isExt = settings.nTable.id === 'dataTableExt';
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
                } else {
                    dateMatch = (eventStart === new Date(filterDate).setHours(0,0,0,0));
                }
            }
            return unitMatch && dateMatch;
        });
    },

    setupTemplateInteractions: function() {
        $('#sidebarToggle').on('click', e => { e.preventDefault(); $('body').toggleClass('sb-sidenav-toggled'); });
        $('#themeToggle').on('click', function() {
            $('body').toggleClass('dark-mode');
            $(this).html($('body').hasClass('dark-mode') ? '<i class="fas fa-sun"></i> Mode' : '<i class="fas fa-moon"></i> Mode');
        });

        $('.menu-link').on('click', (e) => {
            e.preventDefault();
            $('.menu-link').removeClass('active'); $(e.currentTarget).addClass('active');
            $('.view-section').addClass('d-none');
            const target = $(e.currentTarget).data('target');
            $(`#${target}`).removeClass('d-none');
            $('#page-title').text($(e.currentTarget).data('title') || $(e.currentTarget).text().trim());
            
            if (target === 'calendar-view' && this.calendar) setTimeout(() => this.calendar.render(), 100);
            else if (target === 'table-view') setTimeout(() => { 
                if (this.table) this.table.columns.adjust().responsive.recalc(); 
                if (this.tableExt) this.tableExt.columns.adjust().responsive.recalc();
            }, 100);
        });

        $('#filterUnit, #filterDate').on('change', () => { if (this.table) this.table.draw(); });
        $('#btnResetFilter').on('click', () => { $('#filterUnit').val('').trigger('change'); document.querySelector('#filterDate')._flatpickr.clear(); if (this.table) this.table.draw(); });

        $('#filterUnitExt, #filterDateExt').on('change', () => { if (this.tableExt) this.tableExt.draw(); });
        $('#btnResetFilterExt').on('click', () => { $('#filterUnitExt').val('').trigger('change'); document.querySelector('#filterDateExt')._flatpickr.clear(); if (this.tableExt) this.tableExt.draw(); });

        $('#fileCsv').on('change', (e) => { const file = e.target.files[0]; if (!file) return; this.handleCsvUpload(file); $(e.target).val(''); });
        $('#kegiatanForm').on('submit', (e) => { e.preventDefault(); this.saveEvent(); });
    },

    loadData: async function() {
        try {
            const response = await fetch(GAS_WEB_APP_URL);
            const json = await response.json();
            this.eventsData = json.data || [];
        } catch (error) { this.toast('Gagal memuat data dari server.', 'error'); }
    },

    refreshUI: function() {
        const dataInternal = this.eventsData.filter(d => d['Tipe Kegiatan'] !== 'Eksternal');
        const dataEksternal = this.eventsData.filter(d => d['Tipe Kegiatan'] === 'Eksternal');

        if (this.table) { this.table.clear(); this.table.rows.add(dataInternal); this.table.draw(); }
        if (this.tableExt) { this.tableExt.clear(); this.tableExt.rows.add(dataEksternal); this.tableExt.draw(); }
        if (this.calendar) {
            this.calendar.removeAllEvents();
            this.calendar.addEventSource(this.formatEventsForCalendar(this.eventsData));
        }
        DashboardAnalytics.populateCounters(this.eventsData);
        DashboardAnalytics.renderCharts(this.eventsData);
        DashboardAnalytics.detectConflicts(this.eventsData);
    },

    formatEventsForCalendar: function(data) {
        return data.map(item => {
            const startDate = new Date(item['Tanggal Mulai']);
            const endDate = new Date(item['Tanggal Selesai']);
            const exclusiveEndDate = new Date(endDate); exclusiveEndDate.setDate(exclusiveEndDate.getDate() + 1);

            let isExt = item['Tipe Kegiatan'] === 'Eksternal';
            return {
                id: item['ID (UUID)'],
                title: (isExt ? '[EKSTERNAL] ' : '') + `[${item.Unit}] ${item['Program Kerja']}`,
                start: startDate.toISOString().split('T')[0],
                end: exclusiveEndDate.toISOString().split('T')[0],
                allDay: true,
                backgroundColor: isExt ? '#ffc107' : this.getUnitColorCode(item.Unit),
                borderColor: isExt ? '#ffc107' : this.getUnitColorCode(item.Unit),
                textColor: isExt ? '#000000' : '#ffffff',
                extendedProps: item
            };
        });
    },

    initDataTables: function() {
        const dataInternal = this.eventsData.filter(d => d['Tipe Kegiatan'] !== 'Eksternal');
        const dataEksternal = this.eventsData.filter(d => d['Tipe Kegiatan'] === 'Eksternal');

        const dtDom = '<"row align-items-center mb-3"<"col-sm-12 col-md-6"B><"col-sm-12 col-md-6 d-flex justify-content-md-end"f>>rt<"row align-items-center mt-3"<"col-sm-12 col-md-5"i><"col-sm-12 col-md-7 d-flex justify-content-md-end"p>>';
        const cols = [
            { data: null, className: 'text-center', defaultContent: '', render: (d, t, r, meta) => meta.row + 1 },
            { data: 'Unit', defaultContent: '-', render: (d, t, r) => r['Tipe Kegiatan'] === 'Eksternal' ? `<span class="badge bg-warning text-dark">${d}</span>` : d },
            { data: 'Program Kerja', className: 'fw-bold text-dark', defaultContent: '-' },
            { data: 'Waktu (Teks)', defaultContent: '-' },
            { data: 'PIC', defaultContent: '-' },
            { 
                data: 'ID (UUID)', className: 'text-center', defaultContent: '',
                render: id => `
                    <div class="d-flex justify-content-center gap-2">
                        <button class="btn btn-sm btn-info btn-icon text-white" onclick="app.viewDetail('${id}')" title="Lihat Detail"><i class="fas fa-eye"></i></button>
                        <button class="btn btn-sm btn-primary btn-icon" onclick="app.editEvent('${id}')" title="Edit"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-danger btn-icon" onclick="app.deleteEvent('${id}')" title="Hapus"><i class="fas fa-trash-alt"></i></button>
                    </div>`
            }
        ];

        if ($.fn.DataTable.isDataTable('#dataTable')) $('#dataTable').DataTable().destroy();
        if ($.fn.DataTable.isDataTable('#dataTableExt')) $('#dataTableExt').DataTable().destroy();

        this.table = $('#dataTable').DataTable({
            data: dataInternal, responsive: true, scrollX: true, dom: dtDom, columns: cols,
            buttons: [
                { extend: 'copy', text: '<i class="fas fa-copy me-1"></i> Copy', className: 'btn btn-sm btn-outline-primary mb-2' },
                { extend: 'excel', text: '<i class="fas fa-file-excel me-1"></i> Excel', className: 'btn btn-sm btn-outline-success mb-2' },
                { extend: 'print', text: '<i class="fas fa-print me-1"></i> Print', className: 'btn btn-sm btn-outline-secondary mb-2' }
            ]
        });

        this.tableExt = $('#dataTableExt').DataTable({
            data: dataEksternal, responsive: true, scrollX: true, dom: dtDom, columns: cols,
            buttons: [
                { extend: 'copy', text: '<i class="fas fa-copy me-1"></i> Copy', className: 'btn-purple mb-2' },
                { extend: 'excel', text: '<i class="fas fa-file-excel me-1"></i> Excel', className: 'btn-purple mb-2' },
                { extend: 'print', text: '<i class="fas fa-print me-1"></i> Print', className: 'btn-purple mb-2' }
            ]
        });
    },

    initCalendar: function() {
        const calElement = document.getElementById('calendar');
        this.calendar = new FullCalendar.Calendar(calElement, {
            initialView: 'dayGridMonth', firstDay: 0, 
            headerToolbar: { left: 'today prev,next', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' },
            events: this.formatEventsForCalendar(this.eventsData), editable: true, droppable: true, selectable: true, dayMaxEvents: true,
            dateClick: (info) => { this.openModal(); $('#tanggal_mulai').val(info.dateStr); },
            eventClick: (info) => { this.viewDetail(info.event.id); },
            eventDrop: (info) => { this.syncDragDrop(info.event); },
            eventResize: (info) => { this.syncDragDrop(info.event); }
        });
    },

    getUnitColorCode: function(unit) {
        const colors = {
            'Akademik dan Kerja Sama': '#0d6efd', 'Non Akademik dan Kemahasiswaan': '#dc3545', 'Lembaga Penjaminan Mutu (LPM)': '#6f42c1', 'LP2M': '#198754',
            'Program Studi Pembangunan Sosial': '#0dcaf0', 'Program Studi Ilmu Pemerintahan': '#fd7e14', 'Sekretariat': '#ffc107', 'Unit Pangkalan Data & IT': '#20c997',
            'Campus Ministry': '#e83e8c', 'Penerimaan Mahasiswa Baru (PMB)': '#6610f2', 'UPT Perpustakaan': '#d63384'
        };
        return colors[unit] || '#6c757d';
    },

    viewDetail: function(id) {
        const item = this.eventsData.find(d => d['ID (UUID)'] === id);
        if (!item) return;

        $('#detTipe').text(item['Tipe Kegiatan'] === 'Eksternal' ? 'Eksternal / Luar Kampus' : 'Internal STPM');
        $('#detProgram').text(item['Program Kerja']);
        $('#detUnit').text(item.Unit);
        $('#detWaktu').text(item['Waktu (Teks)'] || '-');
        $('#detTempat').text(item.Tempat || '-');
        $('#detPic').text(item.PIC);
        $('#detTarget').text(item['Target/Sasaran'] || '-');
        $('#detAspek').text(item.Aspek || '-');
        $('#detAnggaran').text(item.Anggaran || '-');
        $('#detTujuan').text(item.Tujuan || '-');
        $('#detDetail').text(item['Detail Kegiatan'] || '-');
        $('#detOutput').text(item.Output || '-');
        $('#detDampak').text(item.Dampak || '-');

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
        
        $('#event_id').val(item['ID (UUID)']);
        $('#tipe_kegiatan').val(item['Tipe Kegiatan'] || 'Internal').trigger('change'); 
        $('#unit').val(item.Unit).trigger('change');
        $('#aspek').val(item.Aspek);
        $('#program_kerja').val(item['Program Kerja']);
        $('#tujuan').val(item.Tujuan);
        $('#detail_kegiatan').val(item['Detail Kegiatan']);
        $('#waktu_teks').val(item['Waktu (Teks)']);
        
        const formatDate = (dtStr) => new Date(dtStr).toISOString().split('T')[0];
        $('#tanggal_mulai').val(formatDate(item['Tanggal Mulai']));
        $('#tanggal_selesai').val(formatDate(item['Tanggal Selesai']));
        
        $('#tempat').val(item.Tempat);
        $('#pic').val(item.PIC).trigger('change');
        $('#target_sasaran').val(item['Target/Sasaran']);
        $('#anggaran').val(item.Anggaran);
        $('#output').val(item.Output);
        $('#dampak').val(item.Dampak);
        
        $('#kegiatanModal').modal('show');
    },

    saveEvent: function() {
        const payload = {
            id: $('#event_id').val(), tipe: $('#tipe_kegiatan').val(), unit: $('#unit').val(),
            aspek: $('#aspek').val(), program_kerja: $('#program_kerja').val(), tujuan: $('#tujuan').val(),
            detail_kegiatan: $('#detail_kegiatan').val(), waktu_teks: $('#waktu_teks').val(),
            tanggal_mulai: $('#tanggal_mulai').val(), tanggal_selesai: $('#tanggal_selesai').val(),
            tempat: $('#tempat').val(), pic: $('#pic').val(), target_sasaran: $('#target_sasaran').val(),
            anggaran: $('#anggaran').val(), output: $('#output').val(), dampak: $('#dampak').val()
        };

        const action = payload.id ? 'update' : 'add';
        const btn = $('#btnSave');

        const newStart = new Date(payload.tanggal_mulai).getTime();
        const newEnd = new Date(payload.tanggal_selesai).getTime();
        let conflictingEvents = [];

        this.eventsData.forEach(event => {
            if (payload.id && event['ID (UUID)'] === payload.id) return;
            const existStart = new Date(event['Tanggal Mulai']).getTime();
            const existEnd = new Date(event['Tanggal Selesai']).getTime();

            if (!isNaN(existStart) && !isNaN(existEnd) && !isNaN(newStart) && !isNaN(newEnd)) {
                if (newStart <= existEnd && existStart <= newEnd) {
                    conflictingEvents.push(`• <b>${event['Program Kerja']}</b> <span class="text-primary">(${event.Unit})</span>`);
                }
            }
        });

        if (conflictingEvents.length > 0) {
            Swal.fire({
                title: '⚠️ Tabrakan Jadwal',
                html: `<div class="text-start mb-2">Berbenturan dengan kegiatan berikut:</div>
                       <div class="text-start bg-light p-2 rounded mb-3" style="max-height: 120px; overflow-y: auto; font-size: 0.9rem;">${conflictingEvents.join('<br>')}</div>
                       <div class="text-start">Apakah yakin tetap menyimpan?</div>`,
                icon: 'warning', showCancelButton: true, confirmButtonColor: '#0d6efd', cancelButtonColor: '#6c757d',
                confirmButtonText: 'Ya, Tetap Simpan', cancelButtonText: 'Batal', reverseButtons: true
            }).then((result) => { if (result.isConfirmed) this.executeSaveToServer(action, payload, btn); });
        } else { this.executeSaveToServer(action, payload, btn); }
    },

    executeSaveToServer: async function(action, payload, btn) {
        btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-1"></i> Memproses...');
        try {
            const response = await fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action: action, payload: payload }) });
            const result = await response.json();
            if (result.status === 'success') {
                this.toast('Berhasil disimpan!', 'success'); $('#kegiatanModal').modal('hide');
                await this.loadData(); this.refreshUI(); 
            } else throw new Error(result.message);
        } catch (error) { this.toast(error.message, 'error'); } 
        finally { btn.prop('disabled', false).text('Simpan Program Kerja'); }
    },

    deleteEvent: function(id) {
        Swal.fire({
            title: 'Hapus?', text: "Hapus juga dari G-Calendar?", icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc3545', confirmButtonText: 'Ya, hapus!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const response = await fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action: 'delete', id: id }) });
                    const res = await response.json();
                    if(res.status === 'success') { this.toast('Data terhapus.', 'success'); await this.loadData(); this.refreshUI(); }
                } catch (e) { this.toast('Gagal menghapus.', 'error'); }
            }
        });
    },

    syncDragDrop: function(event) {
        const item = event.extendedProps;
        const payload = {
            id: item['ID (UUID)'], tipe: item['Tipe Kegiatan'] || 'Internal', unit: item.Unit, aspek: item.Aspek,
            program_kerja: item['Program Kerja'], tujuan: item.Tujuan, detail_kegiatan: item['Detail Kegiatan'], waktu_teks: item['Waktu (Teks)'],
            tanggal_mulai: event.start.toISOString().split('T')[0],
            tanggal_selesai: event.end ? new Date(event.end.getTime() - 86400000).toISOString().split('T')[0] : event.start.toISOString().split('T')[0],
            tempat: item.Tempat, pic: item.PIC, target_sasaran: item['Target/Sasaran'],
            anggaran: item.Anggaran, output: item.Output, dampak: item.Dampak
        };
        fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action: 'update', payload: payload }) })
        .then(res => res.json()).then(() => { this.toast('Waktu ditarik & disesuaikan', 'info'); this.loadData().then(() => this.refreshUI()); });
    },

    /* ==================================================
       SISTEM IMPORT CSV MATRIKS BARU
       ================================================== */
    handleCsvUpload: function(file) {
        if (typeof Papa === 'undefined') return this.toast('Library CSV belum termuat.', 'error');

        Papa.parse(file, {
            header: true, skipEmptyLines: true,
            complete: async (results) => {
                const data = results.data;
                if (data.length === 0) return this.toast('File CSV kosong', 'warning');

                // Validasi Header Inti yang WAJIB ADA
                const reqHeaders = ['Tipe Kegiatan', 'Unit', 'Program Kerja', 'Tanggal Mulai', 'Tanggal Selesai', 'PIC'];
                const fileHeaders = Object.keys(data[0]);
                const isValid = reqHeaders.every(h => fileHeaders.includes(h));

                if (!isValid) {
                    return Swal.fire('Format Salah', `Pastikan header CSV memiliki minimal kolom: ${reqHeaders.join(', ')}`, 'error');
                }
                this.processBulkImport(data);
            }
        });
    },

    processBulkImport: async function(dataList) {
        const total = dataList.length;
        let successCount = 0; let errorCount = 0;

        Swal.fire({
            title: 'Mengimpor Matriks...',
            html: `<div class="mb-3">Menyinkronkan dengan Database & Google Calendar...</div>
                   <div class="progress" style="height: 25px;"><div id="import-progress" class="progress-bar progress-bar-striped progress-bar-animated bg-primary" style="width: 0%; font-weight: bold;">0%</div></div>
                   <div class="mt-2 small text-muted" id="import-status">Memproses 0 dari ${total}</div>`,
            allowOutsideClick: false, allowEscapeKey: false, showConfirmButton: false
        });

        for (let i = 0; i < total; i++) {
            const row = dataList[i];
            const payload = {
                id: "", 
                tipe: row['Tipe Kegiatan'] === 'Eksternal' ? 'Eksternal' : 'Internal',
                unit: row['Unit'], 
                aspek: row['Aspek'] || '-', 
                program_kerja: row['Program Kerja'], 
                tujuan: row['Tujuan'] || '-', 
                detail_kegiatan: row['Detail Kegiatan'] || '-', 
                waktu_teks: row['Waktu (Teks)'] || '-', 
                tanggal_mulai: row['Tanggal Mulai'], 
                tanggal_selesai: row['Tanggal Selesai'], 
                tempat: row['Tempat'] || '-', 
                pic: row['PIC'], 
                target_sasaran: row['Target/Sasaran'] || '-', 
                anggaran: row['Anggaran'] || '-', 
                output: row['Output'] || '-', 
                dampak: row['Dampak'] || '-'
            };

            try {
                const response = await fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action: 'add', payload: payload }) });
                const result = await response.json();
                if (result.status === 'success') successCount++; else errorCount++;
            } catch (error) { errorCount++; }

            const pct = Math.round(((i + 1) / total) * 100);
            $('#import-progress').css('width', pct + '%').text(pct + '%');
            $('#import-status').text(`Memproses ${i + 1} dari ${total}`);
        }

        Swal.fire({
            title: 'Impor Selesai!',
            html: `Berhasil ditambahkan: <b>${successCount}</b><br>Gagal: <b>${errorCount}</b>`,
            icon: errorCount > 0 ? 'warning' : 'success', confirmButtonText: 'Selesai'
        }).then(() => { this.loadData().then(() => this.refreshUI()); });
    },

    toast: function(message, icon) { Swal.fire({ title: message, icon: icon, toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 }); }
};

$(document).ready(() => app.init());