/**
 * KONFIGURASI UTAMA - SIM KALENDER STPM SANTA URSULA
 * (VERSI DUAL-SHEET + INTEGRASI DOKUMENTASI & GALERI)
 */
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxb_eQbMQtpR3sS6IZiMLqcIzOjtzB2RZ9CSIDr6Yn9UHdTUw4XIw-nwsOIpXK8xLYucg/exec'; 

// HELPER: Konversi DD/MM/YYYY atau YYYY-MM-DD menjadi ISO Format (YYYY-MM-DD)
function parseToISODate(dateStr) {
    if (!dateStr) return '';
    dateStr = String(dateStr).trim();
    
    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(dateStr)) {
        const parts = dateStr.split(/[-/]/);
        return `${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}`;
    }
    
    if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(dateStr)) {
        const parts = dateStr.split(/[-/]/);
        return `${parts[2]}-${String(parts[1]).padStart(2, '0')}-${String(parts[0]).padStart(2, '0')}`;
    }
    
    const dt = new Date(dateStr);
    if (!isNaN(dt.getTime())) return dt.toISOString().split('T')[0];
    return '';
}

// HELPER: Penunda (Sleep) untuk mencegah Google Calendar memblokir sistem (Rate Limiting)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const app = {
    eventsData: [], table: null, tableExt: null, tableDok: null, calendar: null, calendarDok: null,

    init: async function() {
        this.setupPlugins();
        this.setupDataTablesFilter();
        this.setupTemplateInteractions();
        
        await this.loadData();
        $('#app-loader').addClass('d-none'); 
        $('#app-content').removeClass('d-none');
        
        this.initDataTables();
        this.initCalendar();
        if(typeof DashboardAnalytics !== 'undefined') DashboardAnalytics.init(this.eventsData);
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
            const isDok = settings.nTable.id === 'dataTableDok';
            if (isDok) return true;

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
            if ($(this).val() === 'Eksternal') { 
                $('#wrap_deskripsi').removeClass('d-none'); 
                $('#deskripsi').attr('required', true);
            } else { 
                $('#wrap_deskripsi').addClass('d-none'); 
                $('#deskripsi').removeAttr('required').val('');
            }
        });

        $('#sidebarToggle').on('click', e => { e.preventDefault(); $('body').toggleClass('sb-sidenav-toggled'); });
        $('#themeToggle').on('click', function() { 
            $('body').toggleClass('dark-mode'); 
            $(this).html($('body').hasClass('dark-mode') ? '<i class="fas fa-sun"></i> Mode' : '<i class="fas fa-moon"></i> Mode'); 
        });

        $('.menu-link').on('click', (e) => {
            e.preventDefault();
            $('.menu-link').removeClass('active'); $(e.currentTarget).addClass('active');
            $('.view-section').addClass('d-none');
            const target = $(e.currentTarget).data('target'); $(`#${target}`).removeClass('d-none');
            $('#page-title').text($(e.currentTarget).data('title') || $(e.currentTarget).text().trim());
            
            if (target === 'calendar-view' && this.calendar) setTimeout(() => this.calendar.render(), 100);
            else if (target === 'table-view') setTimeout(() => { 
                if (this.table) this.table.columns.adjust().responsive.recalc(); 
                if (this.tableExt) this.tableExt.columns.adjust().responsive.recalc(); 
            }, 100);
            else if (target === 'dokumentasi-view') setTimeout(() => {
                if (this.tableDok) this.tableDok.columns.adjust().responsive.recalc();
                if (this.calendarDok) this.calendarDok.render();
            }, 100);
        });

        const setupFilter = (unitId, dateId, tableObj, resetId) => {
            $(`#${unitId}, #${dateId}`).on('change', () => { if (tableObj) tableObj.draw(); });
            $(`#${resetId}`).on('click', () => { $(`#${unitId}`).val('').trigger('change'); document.querySelector(`#${dateId}`)._flatpickr.clear(); if (tableObj) tableObj.draw(); });
        };
        setupFilter('filterUnit', 'filterDate', this.table, 'btnResetFilter');
        setupFilter('filterUnitExt', 'filterDateExt', this.tableExt, 'btnResetFilterExt');

        $('#fileCsv').on('change', (e) => { const file = e.target.files[0]; if (!file) return; this.handleCsvUpload(file); $(e.target).val(''); });
        $('#kegiatanForm').on('submit', (e) => { e.preventDefault(); this.saveEvent(); });

        // Event Listener untuk Form Dokumentasi
        $('#dok_fotos').on('change', function() {
            if (this.files.length > 10) {
                $('#dok_warning').text('Maksimal hanya 10 foto yang diizinkan!');
                this.value = '';
            } else {
                $('#dok_warning').text('');
            }
        });

        $('#dokumentasiForm').on('submit', async (e) => {
            e.preventDefault();
            const btn = $('#btnSaveDok');
            const files = $('#dok_fotos')[0].files;
            
            btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-2"></i> Mengompres & Uploading...');
            
            try {
                let fotoBase64Array = [];
                for (let i = 0; i < files.length; i++) {
                    const compressed = await app.compressImage(files[i]);
                    fotoBase64Array.push(compressed);
                }

                const payload = {
                    nama_kegiatan: $('#dok_nama').val(),
                    deskripsi: $('#dok_deskripsi').val(),
                    tanggal_mulai: parseToISODate($('#dok_mulai').val()),
                    tanggal_selesai: parseToISODate($('#dok_selesai').val()),
                    fotos: fotoBase64Array
                };

                const res = await fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action: 'add_dok', payload: payload }) });
                const data = await res.json();
                
                if (data.status === 'success') {
                    app.toast('Dokumentasi Tersimpan!', 'success');
                    $('#dokumentasiModal').modal('hide');
                    await app.loadData();
                    app.refreshUI();
                } else {
                    throw new Error(data.message);
                }
            } catch (err) {
                app.toast('Gagal mengupload dokumentasi.', 'error');
            } finally {
                btn.prop('disabled', false).text('Simpan & Upload');
            }
        });
    },

    loadData: async function() {
        try {
            const response = await fetch(GAS_WEB_APP_URL);
            const json = await response.json();
            this.eventsData = json.data || [];
        } catch (error) { this.toast('Gagal memuat data dari server.', 'error'); }
    },

    refreshUI: function() {
        const dataInternal = this.eventsData.filter(d => d.Tipe !== 'Eksternal' && d.Tipe !== 'Dokumentasi');
        const dataEksternal = this.eventsData.filter(d => d.Tipe === 'Eksternal');
        const dataDokumentasi = this.eventsData.filter(d => d.Tipe === 'Dokumentasi');

        if (this.table) { this.table.clear(); this.table.rows.add(dataInternal); this.table.draw(); }
        if (this.tableExt) { this.tableExt.clear(); this.tableExt.rows.add(dataEksternal); this.tableExt.draw(); }
        if (this.calendar) { this.calendar.removeAllEvents(); this.calendar.addEventSource(this.formatEventsForCalendar(this.eventsData.filter(d => d.Tipe !== 'Dokumentasi'))); }
        
        // Render Tabel Dokumentasi
        if ($.fn.DataTable.isDataTable('#dataTableDok')) $('#dataTableDok').DataTable().destroy();
        this.tableDok = $('#dataTableDok').DataTable({
            data: dataDokumentasi, responsive: true, scrollX: true,
            columns: [
                { data: null, className: 'text-center', render: (d, t, r, m) => m.row + 1 },
                { data: 'Nama Kegiatan', className: 'fw-bold text-dark' },
                { data: 'Tanggal Mulai', render: d => {
                    const iso = parseToISODate(d);
                    return iso ? new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
                }},
                { data: 'URL Foto (JSON)', className: 'text-center', render: urls => {
                    let count = 0;
                    try { count = urls ? JSON.parse(urls).length : 0; } catch(e){}
                    return count > 0 ? `<span class="badge bg-success">${count} Foto</span>` : '-';
                }},
                { data: 'ID (UUID)', className: 'text-center', render: (id) => `
                    <button class="btn btn-sm btn-info text-white shadow-sm" onclick="app.lihatGaleri('${id}')"><i class="fas fa-images me-1"></i> Lihat Galeri</button>`
                }
            ]
        });

        // Render Kalender Dokumentasi
        if (this.calendarDok) this.calendarDok.destroy();
        const calDokEvents = dataDokumentasi.map(item => {
            let startStr = parseToISODate(item['Tanggal Mulai']);
            let endStr = parseToISODate(item['Tanggal Selesai']);
            let end = new Date(endStr); end.setDate(end.getDate() + 1);
            return {
                title: item['Nama Kegiatan'],
                start: startStr, end: end.toISOString().split('T')[0],
                allDay: true, backgroundColor: '#198754', borderColor: '#198754'
            };
        });
        
        const elDok = document.getElementById('calendar-dokumentasi');
        if (elDok) {
            this.calendarDok = new FullCalendar.Calendar(elDok, {
                initialView: 'listMonth',
                events: calDokEvents, height: 400
            });
            this.calendarDok.render();
        }

        if(typeof DashboardAnalytics !== 'undefined') {
            DashboardAnalytics.populateCounters(this.eventsData);
            DashboardAnalytics.renderCharts(this.eventsData);
            DashboardAnalytics.detectConflicts(this.eventsData);
        }
    },

    formatEventsForCalendar: function(data) {
        let validEvents = [];
        data.forEach(item => {
            const startStr = parseToISODate(item['Tanggal Mulai']);
            const endStr = parseToISODate(item['Tanggal Selesai']);
            const start = new Date(startStr); const end = new Date(endStr);
            
            if(!isNaN(start) && !isNaN(end)) {
                end.setDate(end.getDate() + 1);
                let isExt = item.Tipe === 'Eksternal';
                validEvents.push({
                    id: item['ID (UUID)'], 
                    title: (isExt ? '[EKSTERNAL] ' : '') + `[${item.Unit}] ${item['Nama Kegiatan']}`,
                    start: startStr, 
                    end: end.toISOString().split('T')[0], 
                    allDay: true,
                    backgroundColor: isExt ? '#ffc107' : this.getUnitColorCode(item.Unit),
                    borderColor: isExt ? '#ffc107' : this.getUnitColorCode(item.Unit),
                    textColor: isExt ? '#000000' : '#ffffff', 
                    extendedProps: item
                });
            }
        });
        return validEvents;
    },

    initDataTables: function() {
        const dInt = this.eventsData.filter(d => d.Tipe !== 'Eksternal' && d.Tipe !== 'Dokumentasi');
        const dExt = this.eventsData.filter(d => d.Tipe === 'Eksternal');
        const dtDom = '<"row align-items-center mb-3"<"col-sm-12 col-md-6"B><"col-sm-12 col-md-6 d-flex justify-content-md-end"f>>rt<"row align-items-center mt-3"<"col-sm-12 col-md-5"i><"col-sm-12 col-md-7 d-flex justify-content-md-end"p>>';
        
        const getBtns = (isExt) => [
            { extend: 'copy', text: '<i class="fas fa-copy me-1"></i> Copy', className: isExt ? 'btn-purple mb-2' : 'btn btn-sm btn-outline-primary mb-2' },
            { extend: 'excel', text: '<i class="fas fa-file-excel me-1"></i> Excel', className: isExt ? 'btn-purple mb-2' : 'btn btn-sm btn-outline-success mb-2' },
            { extend: 'print', text: '<i class="fas fa-print me-1"></i> Print', className: isExt ? 'btn-purple mb-2' : 'btn btn-sm btn-outline-secondary mb-2' }
        ];

        if ($.fn.DataTable.isDataTable('#dataTable')) $('#dataTable').DataTable().destroy();
        if ($.fn.DataTable.isDataTable('#dataTableExt')) $('#dataTableExt').DataTable().destroy();

        // TABEL INTERNAL
        this.table = $('#dataTable').DataTable({ 
            data: dInt, responsive: true, scrollX: true, dom: dtDom, buttons: getBtns(false),
            columns: [
                { data: null, className: 'text-center', defaultContent: '', render: (d, t, r, m) => m.row + 1 },
                { data: 'Unit', defaultContent: '-' },
                { data: 'Nama Kegiatan', className: 'fw-bold text-dark', defaultContent: '-' },
                { data: 'Tanggal Mulai', defaultContent: '-', render: d => {
                    const iso = parseToISODate(d);
                    return iso ? new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
                }},
                { data: 'Tanggal Selesai', defaultContent: '-', render: d => {
                    const iso = parseToISODate(d);
                    return iso ? new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
                }},
                { data: 'PIC', defaultContent: '-' },
                { data: 'ID (UUID)', className: 'text-center', defaultContent: '',
                  render: id => `<div class="d-flex justify-content-center gap-2">
                      <button class="btn btn-sm btn-info btn-icon text-white" onclick="app.viewDetail('${id}')" title="Detail"><i class="fas fa-eye"></i></button>
                      <button class="btn btn-sm btn-primary btn-icon" onclick="app.editEvent('${id}')" title="Edit"><i class="fas fa-edit"></i></button>
                      <button class="btn btn-sm btn-danger btn-icon" onclick="app.deleteEvent('${id}')" title="Hapus"><i class="fas fa-trash-alt"></i></button></div>`
                }
            ]
        });

        // TABEL EKSTERNAL
        this.tableExt = $('#dataTableExt').DataTable({ 
            data: dExt, responsive: true, scrollX: true, dom: dtDom, buttons: getBtns(true),
            columns: [
                { data: null, className: 'text-center', defaultContent: '', render: (d, t, r, m) => m.row + 1 },
                { data: 'Unit', defaultContent: '-', render: d => `<span class="badge bg-warning text-dark">${d}</span>` },
                { data: 'Nama Kegiatan', className: 'fw-bold text-dark', defaultContent: '-' },
                { data: 'Deskripsi Kegiatan', defaultContent: '-', render: d => d ? `<div style="white-space: normal; min-width: 200px;">${d}</div>` : '-' },
                { data: 'Tanggal Mulai', defaultContent: '-', render: d => {
                    const iso = parseToISODate(d);
                    return iso ? new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
                }},
                { data: 'Tanggal Selesai', defaultContent: '-', render: d => {
                    const iso = parseToISODate(d);
                    return iso ? new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
                }},
                { data: 'PIC', defaultContent: '-' },
                { data: 'ID (UUID)', className: 'text-center', defaultContent: '',
                  render: id => `<div class="d-flex justify-content-center gap-2">
                      <button class="btn btn-sm btn-info btn-icon text-white" onclick="app.viewDetail('${id}')" title="Detail"><i class="fas fa-eye"></i></button>
                      <button class="btn btn-sm btn-primary btn-icon" onclick="app.editEvent('${id}')" title="Edit"><i class="fas fa-edit"></i></button>
                      <button class="btn btn-sm btn-danger btn-icon" onclick="app.deleteEvent('${id}')" title="Hapus"><i class="fas fa-trash-alt"></i></button></div>`
                }
            ]
        });
    },

    initCalendar: function() {
        this.calendar = new FullCalendar.Calendar(document.getElementById('calendar'), {
            initialView: 'dayGridMonth', firstDay: 0, 
            headerToolbar: { left: 'today prev,next', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' },
            events: this.formatEventsForCalendar(this.eventsData.filter(d => d.Tipe !== 'Dokumentasi')), editable: true, droppable: true, selectable: true, dayMaxEvents: true,
            dateClick: (i) => { this.openModal(); $('#tanggal_mulai').val(i.dateStr); },
            eventClick: (i) => { this.viewDetail(i.event.id); },
            eventDrop: (i) => { this.syncDragDrop(i.event); }, eventResize: (i) => { this.syncDragDrop(i.event); }
        });
    },

    getUnitColorCode: function(unit) {
        const colors = {
            'Akademik dan Kerja Sama': '#0d6efd', 'Non Akademik dan Kemahasiswaan': '#dc3545', 'Lembaga Penjaminan Mutu (LPM)': '#6f42c1', 'LP2M': '#198754',
            'Program Studi Pembangunan Sosial': '#0dcaf0', 'Program Studi Ilmu Pemerintahan': '#fd7e14', 'Sekretariat': '#ffc107', 'Unit Pangkalan Data & IT': '#20c997',
            'Campus Ministry': '#e83e8c', 'Penerimaan Mahasiswa Baru (PMB)': '#6610f2', 'UPT Perpustakaan': '#d63384', 'Instansi Eksternal (Luar Kampus)': '#ffc107'
        }; return colors[unit] || '#6c757d';
    },

    viewDetail: function(id) {
        const item = this.eventsData.find(d => d['ID (UUID)'] === id);
        if (!item) return;
        const isExt = item.Tipe === 'Eksternal';
        const tipeStr = isExt ? 'Eksternal / Luar Kampus' : 'Internal STPM';
        
        const isoMulai = parseToISODate(item['Tanggal Mulai']);
        const isoSelesai = parseToISODate(item['Tanggal Selesai']);
        const tglMulai = isoMulai ? new Date(isoMulai).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';
        const tglSelesai = isoSelesai ? new Date(isoSelesai).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';
        
        let htmlContent = `
            <table class="table table-sm table-bordered text-start mt-3">
                <tr><th width="35%" class="bg-light">Tipe</th><td><span class="badge ${isExt ? 'bg-warning text-dark' : 'bg-primary'}">${tipeStr}</span></td></tr>
                <tr><th class="bg-light">Unit / Instansi</th><td>${item.Unit || '-'}</td></tr>
                <tr><th class="bg-light">Nama Kegiatan</th><td class="fw-bold">${item['Nama Kegiatan'] || '-'}</td></tr>
                <tr><th class="bg-light">Tanggal</th><td>${tglMulai} <br><small>s.d</small><br> ${tglSelesai}</td></tr>
                <tr><th class="bg-light">PIC / Delegasi</th><td>${item.PIC || '-'}</td></tr>
        `;
        if (isExt) htmlContent += `<tr><th class="bg-light">Deskripsi</th><td>${item['Deskripsi Kegiatan'] || '-'}</td></tr>`;
        htmlContent += `</table>`;

        Swal.fire({ title: 'Detail Kegiatan', html: htmlContent, icon: 'info', confirmButtonText: 'Tutup', confirmButtonColor: '#0d6efd' });
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
        $('#tipe_kegiatan').val(item.Tipe || 'Internal').trigger('change'); 
        $('#unit').val(item.Unit).trigger('change'); 
        $('#nama_kegiatan').val(item['Nama Kegiatan']);
        $('#deskripsi').val(item['Deskripsi Kegiatan']); 
        
        $('#tanggal_mulai').val(parseToISODate(item['Tanggal Mulai']));
        $('#tanggal_selesai').val(parseToISODate(item['Tanggal Selesai']));
        $('#pic').val(item.PIC).trigger('change'); 
        $('#kegiatanModal').modal('show');
    },

    saveEvent: function() {
        const payload = {
            id: $('#event_id').val(), tipe: $('#tipe_kegiatan').val(), unit: $('#unit').val(), 
            nama_kegiatan: $('#nama_kegiatan').val(), deskripsi: $('#deskripsi').val() || '', 
            tanggal_mulai: parseToISODate($('#tanggal_mulai').val()), 
            tanggal_selesai: parseToISODate($('#tanggal_selesai').val()), 
            pic: $('#pic').val()
        };

        const action = payload.id ? 'update' : 'add';
        const btn = $('#btnSave');

        const newStart = new Date(payload.tanggal_mulai).getTime(); 
        const newEnd = new Date(payload.tanggal_selesai).getTime();
        let conflicts = [];

        this.eventsData.forEach(ev => {
            if (payload.id && ev['ID (UUID)'] === payload.id) return;
            const eStart = new Date(parseToISODate(ev['Tanggal Mulai'])).getTime(); 
            const eEnd = new Date(parseToISODate(ev['Tanggal Selesai'])).getTime();
            
            if (!isNaN(eStart) && !isNaN(eEnd) && !isNaN(newStart) && !isNaN(newEnd)) {
                if (newStart <= eEnd && eStart <= newEnd) conflicts.push(`• <b>${ev['Nama Kegiatan']}</b> <span class="text-primary">(${ev.Unit})</span>`);
            }
        });

        if (conflicts.length > 0) {
            Swal.fire({
                title: '⚠️ Tabrakan Jadwal',
                html: `<div class="text-start mb-2">Berbenturan dengan kegiatan berikut:</div><div class="text-start bg-light p-2 rounded mb-3" style="max-height: 120px; overflow-y: auto; font-size: 0.9rem;">${conflicts.join('<br>')}</div><div class="text-start">Apakah yakin tetap menyimpan?</div>`,
                icon: 'warning', showCancelButton: true, confirmButtonColor: '#0d6efd', cancelButtonColor: '#6c757d', confirmButtonText: 'Ya, Simpan'
            }).then(r => { if (r.isConfirmed) this.executeSaveToServer(action, payload, btn); });
        } else this.executeSaveToServer(action, payload, btn);
    },

    executeSaveToServer: async function(action, payload, btn) {
        btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-1"></i> Memproses...');
        try {
            const res = await fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action: action, payload: payload }) });
            const data = await res.json();
            if (data.status === 'success') { this.toast('Tersimpan!', 'success'); $('#kegiatanModal').modal('hide'); await this.loadData(); this.refreshUI(); } 
            else throw new Error(data.message);
        } catch (err) { this.toast(err.message, 'error'); } finally { btn.prop('disabled', false).text('Simpan Kegiatan'); }
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
            id: it['ID (UUID)'], tipe: it.Tipe || 'Internal', unit: it.Unit, nama_kegiatan: it['Nama Kegiatan'], deskripsi: it['Deskripsi Kegiatan'] || '', 
            tanggal_mulai: event.start.toISOString().split('T')[0],
            tanggal_selesai: event.end ? new Date(event.end.getTime() - 86400000).toISOString().split('T')[0] : event.start.toISOString().split('T')[0],
            pic: it.PIC
        };
        fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action: 'update', payload: payload }) })
        .then(res => res.json()).then(() => { this.toast('Waktu ditarik', 'info'); this.loadData().then(() => this.refreshUI()); });
    },

    /* ==================================================
       SISTEM IMPORT CSV (KONVERSI AUTOMATIS & ANTI RATE LIMIT)
       ================================================== */
    handleCsvUpload: function(file) {
        if (typeof Papa === 'undefined') return this.toast('Library CSV belum termuat.', 'error');
        
        Papa.parse(file, {
            header: true, 
            skipEmptyLines: true,
            transformHeader: function(h) {
                return h.replace(/^\uFEFF/, '').trim();
            },
            complete: async (results) => {
                const data = results.data;
                if (data.length === 0) return this.toast('File CSV kosong', 'warning');

                const fileHeaders = Object.keys(data[0]);
                const requiredHeaders = ['Unit', 'Nama Kegiatan', 'Tanggal Mulai', 'Tanggal Selesai', 'PIC'];
                const isValid = requiredHeaders.every(h => fileHeaders.includes(h));

                if (!isValid) {
                    return Swal.fire('Format Salah', `Pastikan header CSV persis memiliki 5 kolom ini: <br><b>${requiredHeaders.join(', ')}</b>`, 'error');
                }
                this.processBulkImport(data);
            },
            error: () => { this.toast('Gagal membaca file CSV', 'error'); }
        });
    },

    processBulkImport: async function(dataList) {
        const total = dataList.length; let successCount = 0; let errorCount = 0;

        Swal.fire({
            title: 'Mengimpor Kegiatan Internal...',
            html: `<div class="mb-3 text-warning fw-bold"><i class="fas fa-info-circle me-1"></i> Jangan tutup browser selama proses ini!</div>
                   <div class="progress" style="height: 25px;"><div id="import-progress" class="progress-bar progress-bar-striped progress-bar-animated bg-primary" style="width: 0%; font-weight: bold;">0%</div></div>
                   <div class="mt-2 small text-muted" id="import-status">Memproses 0 dari ${total}</div>`,
            allowOutsideClick: false, allowEscapeKey: false, showConfirmButton: false
        });

        for (let i = 0; i < total; i++) {
            const row = dataList[i];
            
            const payload = {
                id: "", 
                tipe: 'Internal', 
                deskripsi: '-',
                unit: row['Unit'], 
                nama_kegiatan: row['Nama Kegiatan'],
                tanggal_mulai: parseToISODate(row['Tanggal Mulai']), 
                tanggal_selesai: parseToISODate(row['Tanggal Selesai']), 
                pic: row['PIC']
            };

            try {
                const response = await fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action: 'add', payload: payload }) });
                const result = await response.json();
                if (result.status === 'success') successCount++; else errorCount++;
            } catch (error) { errorCount++; }

            const percent = Math.round(((i + 1) / total) * 100);
            $('#import-progress').css('width', percent + '%').text(percent + '%');
            $('#import-status').text(`Memproses ${i + 1} dari ${total}`);

            await sleep(400); 
        }

        Swal.fire({
            title: 'Impor Selesai!',
            html: `Jadwal Internal ditambahkan: <b class="text-success">${successCount}</b><br>Gagal / Duplikat: <b class="text-danger">${errorCount}</b>`,
            icon: errorCount > 0 ? 'warning' : 'success', confirmButtonText: 'Selesai'
        }).then(() => { this.loadData().then(() => this.refreshUI()); });
    },

    /* ==================================================
       SISTEM DOKUMENTASI KEGIATAN & KOMPRES FOTO
       ================================================== */
    compressImage: function(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800; 
                    const scaleSize = MAX_WIDTH / img.width;
                    canvas.width = MAX_WIDTH;
                    canvas.height = img.height * scaleSize;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    resolve({
                        data: dataUrl.split(',')[1],
                        mime: 'image/jpeg'
                    });
                }
            };
        });
    },

    openDokumentasiModal: function() {
        $('#dokumentasiForm')[0].reset();
        $('#dok_id').val('');
        $('#dok_warning').text('');
        $('#dokumentasiModal').modal('show');
    },

    lihatGaleri: function(id) {
        const item = this.eventsData.find(d => d['ID (UUID)'] === id);
        if (!item) return;
        
        let urls = [];
        try { urls = JSON.parse(item['URL Foto (JSON)']); } catch(e) {}
        
        if (urls.length === 0) return Swal.fire('Kosong', 'Tidak ada foto untuk kegiatan ini.', 'info');

        let carouselIndicators = '';
        let carouselItems = '';

        urls.forEach((url, index) => {
            const active = index === 0 ? 'active' : '';
            carouselIndicators += `<button type="button" data-bs-target="#dokCarousel" data-bs-slide-to="${index}" class="${active}"></button>`;
            carouselItems += `
                <div class="carousel-item ${active}">
                    <img src="${url}" class="d-block w-100 rounded" style="max-height: 400px; object-fit: contain; background: #000;" alt="Foto ${index+1}">
                    <div class="carousel-caption d-none d-md-block bg-dark bg-opacity-50 rounded p-2 mt-2">
                        <a href="${url}" target="_blank" class="btn btn-sm btn-light fw-bold"><i class="fas fa-download me-1"></i> Buka Foto Resolusi Penuh</a>
                    </div>
                </div>`;
        });

        const htmlContent = `
            <div class="text-start mb-3"><b>Deskripsi:</b><br>${item.Deskripsi || '-'}</div>
            <div id="dokCarousel" class="carousel slide" data-bs-ride="carousel">
                <div class="carousel-indicators">${carouselIndicators}</div>
                <div class="carousel-inner shadow-sm">${carouselItems}</div>
                <button class="carousel-control-prev" type="button" data-bs-target="#dokCarousel" data-bs-slide="prev">
                    <span class="carousel-control-prev-icon" aria-hidden="true"></span>
                </button>
                <button class="carousel-control-next" type="button" data-bs-target="#dokCarousel" data-bs-slide="next">
                    <span class="carousel-control-next-icon" aria-hidden="true"></span>
                </button>
            </div>
        `;

        Swal.fire({
            title: item['Nama Kegiatan'], 
            html: htmlContent,
            width: '800px', 
            showConfirmButton: false, 
            showCloseButton: true
        });
    },

    resetSemuaData: function() {
        Swal.fire({
            title: '⚠️ BAHAYA: RESET TOTAL SISTEM?',
            html: 'Tindakan ini akan <b>MENGHAPUS SELURUH KEGIATAN</b> di Spreadsheet (Internal & Eksternal) dan <b>MENGOSONGKAN GOOGLE CALENDAR</b>.<br><br>Gunakan ini hanya untuk pergantian tahun akademik atau membersihkan kesalahan data massal.<br><br><b>Tindakan ini tidak bisa dibatalkan!</b>',
            icon: 'error', showCancelButton: true, confirmButtonColor: '#dc3545', cancelButtonColor: '#6c757d',
            confirmButtonText: '<i class="fas fa-trash-alt me-1"></i> Ya, Hapus Semua!', cancelButtonText: 'Batal', reverseButtons: true
        }).then(async (result) => {
            if (result.isConfirmed) {
                Swal.fire({ title: 'Sedang Mereset...', html: 'Menghapus data di Google Calendar dan Sheets. Harap tunggu...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
                try {
                    const res = await (await fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action: 'reset' }) })).json();
                    if (res.status === 'success') { Swal.fire('Sistem Bersih!', 'Semua data dikosongkan.', 'success'); await this.loadData(); this.refreshUI(); } 
                    else throw new Error(res.message);
                } catch (e) { Swal.fire('Gagal Reset', 'Terjadi kesalahan saat menghubungi server.', 'error'); }
            }
        });
    },

    toast: function(message, icon) { Swal.fire({ title: message, icon: icon, toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 }); }
};

$(document).ready(() => app.init());