/**
 * KONFIGURASI UTAMA
 * URL Deployment Google Apps Script
 */
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxb_eQbMQtpR3sS6IZiMLqcIzOjtzB2RZ9CSIDr6Yn9UHdTUw4XIw-nwsOIpXK8xLYucg/exec'; 

const app = {
    eventsData: [],
    table: null,
    calendar: null,

    init: async function() {
        this.setupPlugins();
        this.setupDataTablesFilter();
        this.setupTemplateInteractions();
        
        await this.loadData();
        
        // Sembunyikan loader dan tampilkan konten utama
        $('#app-loader').addClass('d-none');
        $('#app-content').removeClass('d-none');
        
        this.initDataTables();
        this.initCalendar();
        DashboardAnalytics.init(this.eventsData);
    },

    setupPlugins: function() {
        // Plugin Form Tambah Kegiatan
        $('.select2').select2({ theme: 'bootstrap-5', dropdownParent: $('#kegiatanModal') });
        $('.flatpickr-date').flatpickr({ enableTime: false, dateFormat: "Y-m-d" });

        // Plugin Filter Tabel
        $('.select2-filter').select2({ theme: 'bootstrap-5' });
        $('.flatpickr-range').flatpickr({
            mode: "range",          
            dateFormat: "Y-m-d",
            altInput: true,         
            altFormat: "d M Y"
        });
    },

    setupDataTablesFilter: function() {
        // Mendaftarkan logika pencarian kustom ke DataTables
        $.fn.dataTable.ext.search.push((settings, data, dataIndex) => {
            if (settings.nTable.id !== 'dataTable') return true;
            if (!this.table) return true;

            const filterUnit = $('#filterUnit').val();
            const filterDate = $('#filterDate').val(); 
            
            const rowData = this.table.row(dataIndex).data(); 
            if (!rowData) return true;

            // 1. Pengecekan Unit
            const unitMatch = filterUnit === "" || rowData.Unit === filterUnit;
            
            // 2. Pengecekan Rentang Tanggal
            let dateMatch = true;
            if (filterDate) {
                const eventStart = new Date(rowData['Tanggal Mulai']).setHours(0,0,0,0);

                if (filterDate.includes(' to ')) {
                    const dates = filterDate.split(' to ');
                    const startFilter = new Date(dates[0]).setHours(0,0,0,0);
                    const endFilter = new Date(dates[1]).setHours(23,59,59,999);
                    dateMatch = (eventStart >= startFilter && eventStart <= endFilter);
                } else {
                    const targetDate = new Date(filterDate).setHours(0,0,0,0);
                    dateMatch = (eventStart === targetDate);
                }
            }

            return unitMatch && dateMatch;
        });
    },

    setupTemplateInteractions: function() {
        // Logika Dropdown Tipe Kegiatan (Internal/Eksternal)
        $('#tipe_kegiatan').on('change', function() {
            if ($(this).val() === 'Eksternal') {
                $('#wrap_deskripsi').removeClass('d-none');
                $('#deskripsi').attr('required', true);
            } else {
                $('#wrap_deskripsi').addClass('d-none');
                $('#deskripsi').removeAttr('required').val('');
            }
        });

        // Toggle Sidebar
        $('#sidebarToggle').on('click', function(e) {
            e.preventDefault(); 
            $('body').toggleClass('sb-sidenav-toggled');
        });

        // Toggle Dark/Light Mode
        $('#themeToggle').on('click', function() {
            $('body').toggleClass('dark-mode');
            const isDark = $('body').hasClass('dark-mode');
            $(this).html(isDark ? '<i class="fas fa-sun"></i> Mode' : '<i class="fas fa-moon"></i> Mode');
        });

        // Navigasi Antar Halaman (SPA)
        $('.menu-link').on('click', (e) => {
            e.preventDefault();
            const $this = $(e.currentTarget);

            $('.menu-link').removeClass('active');
            $this.addClass('active');
            
            $('.view-section').addClass('d-none');
            const target = $this.data('target');
            $(`#${target}`).removeClass('d-none');
            
            const title = $this.data('title') || $this.text().trim();
            const icon = $this.data('icon');
            $('#page-title').text(title);
            
            if (icon) {
                $('#header-icon').replaceWith(`<i id="header-icon" data-feather="${icon}"></i>`);
                if (typeof feather !== 'undefined') feather.replace();
            }

            if (target === 'calendar-view' && this.calendar) {
                setTimeout(() => { this.calendar.render(); }, 100);
            } else if (target === 'table-view' && this.table) {
                setTimeout(() => { this.table.columns.adjust().responsive.recalc(); }, 100);
            }
        });

        // Event Listener: Filter DataTables
        $('#filterUnit, #filterDate').on('change', () => {
            if (this.table) this.table.draw();
        });

        // Event Listener: Reset Filter
        $('#btnResetFilter').on('click', () => {
            $('#filterUnit').val('').trigger('change');
            document.querySelector('#filterDate')._flatpickr.clear();
            if (this.table) this.table.draw();
        });

        // Event Listener: Import CSV
        $('#fileCsv').on('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            this.handleCsvUpload(file);
            $(e.target).val(''); 
        });

        // Event Listener: Submit Form Tambah/Edit
        $('#kegiatanForm').on('submit', (e) => {
            e.preventDefault();
            this.saveEvent();
        });
    },

    loadData: async function() {
        try {
            const response = await fetch(GAS_WEB_APP_URL);
            const json = await response.json();
            this.eventsData = json.data || [];
        } catch (error) {
            this.toast('Gagal memuat data dari server.', 'error');
        }
    },

    refreshUI: function() {
        if (this.table) {
            this.table.clear();
            this.table.rows.add(this.eventsData);
            this.table.draw();
        }
        if (this.calendar) {
            const formattedEvents = this.formatEventsForCalendar(this.eventsData);
            this.calendar.removeAllEvents();
            this.calendar.addEventSource(formattedEvents);
        }
        DashboardAnalytics.populateCounters(this.eventsData);
        DashboardAnalytics.renderCharts(this.eventsData);
        DashboardAnalytics.detectConflicts(this.eventsData);
    },

    formatEventsForCalendar: function(data) {
        return data.map(item => {
            const startDate = new Date(item['Tanggal Mulai']);
            const endDate = new Date(item['Tanggal Selesai']);
            
            // FullCalendar Fix: Tambah 1 hari ke End Date
            const exclusiveEndDate = new Date(endDate);
            exclusiveEndDate.setDate(exclusiveEndDate.getDate() + 1);

            let eventTitle = `[${item.Unit}] ${item['Nama Kegiatan']}`;
            let bgColor = this.getUnitColorCode(item.Unit);
            let textColor = '#ffffff';

            // Jika eksternal, gunakan warna Kuning mencolok
            if (item.Tipe === 'Eksternal') {
                eventTitle = `[EKSTERNAL] ${item['Nama Kegiatan']}`;
                bgColor = '#ffc107'; 
                textColor = '#000000';
            }

            return {
                id: item['ID (UUID)'],
                title: eventTitle,
                start: startDate.toISOString().split('T')[0],
                end: exclusiveEndDate.toISOString().split('T')[0],
                allDay: true,
                backgroundColor: bgColor,
                borderColor: bgColor,
                textColor: textColor,
                extendedProps: item
            };
        });
    },

    initDataTables: function() {
        this.table = $('#dataTable').DataTable({
            data: this.eventsData,
            responsive: true,
            scrollX: true,
            dom: '<"row align-items-center mb-3"<"col-sm-12 col-md-6"B><"col-sm-12 col-md-6 d-flex justify-content-md-end"f>>rt<"row align-items-center mt-3"<"col-sm-12 col-md-5"i><"col-sm-12 col-md-7 d-flex justify-content-md-end"p>>',
            buttons: [
                { extend: 'copy', text: '<i class="fas fa-copy me-1"></i> Copy', className: 'btn-copy mb-2' },
                { extend: 'excel', text: '<i class="fas fa-file-excel me-1"></i> Excel', className: 'btn-excel mb-2' },
                { extend: 'pdf', text: '<i class="fas fa-file-pdf me-1"></i> PDF', className: 'btn-pdf mb-2' },
                { extend: 'print', text: '<i class="fas fa-print me-1"></i> Print', className: 'btn-print mb-2' }
            ],
            columns: [
                { data: null, className: 'text-center', render: (d, t, r, meta) => meta.row + 1 },
                { data: 'Unit' },
                { 
                    data: 'Nama Kegiatan', 
                    className: 'fw-bold text-dark',
                    render: (data, type, row) => {
                        // Badge untuk Kegiatan Eksternal
                        if (row.Tipe === 'Eksternal') {
                            return `${data} <span class="badge bg-warning text-dark ms-2 shadow-sm"><i class="fas fa-external-link-alt me-1"></i>Eksternal</span>`;
                        }
                        return data;
                    }
                },
                { 
                    data: 'Tanggal Mulai', 
                    render: data => data ? new Date(data).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'
                },
                { 
                    data: 'Tanggal Selesai', 
                    render: data => data ? new Date(data).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'
                },
                { data: 'PIC' },
                { 
                    data: 'ID (UUID)', 
                    className: 'text-center', 
                    render: id => `
                        <div class="d-flex justify-content-center gap-2">
                            <button class="btn btn-sm btn-primary btn-icon" onclick="app.editEvent('${id}')" title="Edit"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-sm btn-danger btn-icon" onclick="app.deleteEvent('${id}')" title="Hapus"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    `
                }
            ],
            drawCallback: function() {
                if (typeof feather !== 'undefined') feather.replace();
            }
        });
    },

    initCalendar: function() {
        const calElement = document.getElementById('calendar');
        const formattedEvents = this.formatEventsForCalendar(this.eventsData);

        this.calendar = new FullCalendar.Calendar(calElement, {
            initialView: 'dayGridMonth',
            firstDay: 0, 
            headerToolbar: {
                left: 'today prev,next',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            buttonText: { today: 'Hari ini', month: 'Bulan', week: 'Minggu', day: 'Hari' },
            events: formattedEvents,
            editable: true,
            droppable: true,
            selectable: true,
            dayMaxEvents: true,
            
            dateClick: (info) => {
                this.openModal();
                $('#tanggal_mulai').val(info.dateStr); 
            },
            eventClick: (info) => { this.editEvent(info.event.id); },
            eventDrop: (info) => { this.syncDragDrop(info.event); },
            eventResize: (info) => { this.syncDragDrop(info.event); }
        });
    },

    getUnitColorCode: function(unit) {
        const colors = {
            'Akademik dan Kerja Sama': '#0d6efd',
            'Non Akademik dan Kemahasiswaan': '#dc3545',
            'Lembaga Penjaminan Mutu (LPM)': '#6f42c1',
            'LP2M': '#198754',
            'Program Studi Pembangunan Sosial': '#0dcaf0',
            'Program Studi Ilmu Pemerintahan': '#fd7e14',
            'Sekretariat': '#ffc107',
            'Unit Pangkalan Data & IT': '#20c997',
            'Campus Ministry': '#e83e8c',
            'Penerimaan Mahasiswa Baru (PMB)': '#6610f2',
            'UPT Perpustakaan': '#d63384'
        };
        return colors[unit] || '#6c757d';
    },

    openModal: function() {
        $('#kegiatanForm')[0].reset();
        $('#event_id').val('');
        $('#tipe_kegiatan').val('Internal').trigger('change'); 
        $('.select2').val('').trigger('change');
        $('#kegiatanModal').modal('show');
    },

    editEvent: function(id) {
        const item = this.eventsData.find(d => d['ID (UUID)'] === id);
        if (!item) return;
        
        $('#event_id').val(item['ID (UUID)']);
        $('#tipe_kegiatan').val(item.Tipe || 'Internal').trigger('change'); 
        if(item.Tipe === 'Eksternal') $('#deskripsi').val(item['Deskripsi Kegiatan']);
        
        $('#unit').val(item.Unit).trigger('change');
        $('#pic').val(item.PIC).trigger('change');
        $('#nama_kegiatan').val(item['Nama Kegiatan']);
        
        const formatDate = (dtStr) => new Date(dtStr).toISOString().split('T')[0];
        $('#tanggal_mulai').val(formatDate(item['Tanggal Mulai']));
        $('#tanggal_selesai').val(formatDate(item['Tanggal Selesai']));
        
        $('#kegiatanModal').modal('show');
    },

    saveEvent: function() {
        const payload = {
            id: $('#event_id').val(),
            tipe: $('#tipe_kegiatan').val(), 
            deskripsi: $('#deskripsi').val() || '', 
            unit: $('#unit').val(),
            nama_kegiatan: $('#nama_kegiatan').val(),
            tanggal_mulai: $('#tanggal_mulai').val(),
            tanggal_selesai: $('#tanggal_selesai').val(),
            pic: $('#pic').val()
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

            // Proteksi dari data Invalid Date
            if (!isNaN(existStart) && !isNaN(existEnd) && !isNaN(newStart) && !isNaN(newEnd)) {
                if (newStart <= existEnd && existStart <= newEnd) {
                    conflictingEvents.push(`• <b>${event['Nama Kegiatan']}</b> <span class="text-primary">(${event.Unit})</span>`);
                }
            }
        });

        if (conflictingEvents.length > 0) {
            Swal.fire({
                title: '⚠️ Peringatan Tabrakan Jadwal',
                html: `
                    <div class="text-start mb-2">Tanggal kegiatan ini berbenturan dengan kegiatan berikut:</div>
                    <div class="text-start bg-light p-2 rounded mb-3" style="max-height: 120px; overflow-y: auto; font-size: 0.9rem;">
                        ${conflictingEvents.join('<br>')}
                    </div>
                    <div class="text-start">Apakah Anda yakin ingin tetap menyimpannya?</div>
                `,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#0d6efd',
                cancelButtonColor: '#6c757d',
                confirmButtonText: '<i class="fas fa-save me-1"></i> Ya, Tetap Simpan',
                cancelButtonText: 'Batal',
                reverseButtons: true
            }).then((result) => {
                if (result.isConfirmed) {
                    this.executeSaveToServer(action, payload, btn);
                }
            });
        } else {
            this.executeSaveToServer(action, payload, btn);
        }
    },

    executeSaveToServer: async function(action, payload, btn) {
        btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-1"></i> Memproses...');

        try {
            const response = await fetch(GAS_WEB_APP_URL, {
                method: 'POST',
                body: JSON.stringify({ action: action, payload: payload })
            });
            const result = await response.json();
            
            if (result.status === 'success') {
                this.toast('Kegiatan berhasil disimpan!', 'success');
                $('#kegiatanModal').modal('hide');
                
                await this.loadData();
                this.refreshUI(); 
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            this.toast(error.message, 'error');
        } finally {
            btn.prop('disabled', false).text('Simpan Kegiatan');
        }
    },

    deleteEvent: function(id) {
        Swal.fire({
            title: 'Hapus?', text: "Hapus juga dari G-Calendar?", icon: 'warning',
            showCancelButton: true, confirmButtonColor: '#dc3545', confirmButtonText: 'Ya, hapus!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const response = await fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action: 'delete', id: id }) });
                    const res = await response.json();
                    if(res.status === 'success') {
                        this.toast('Data terhapus.', 'success');
                        await this.loadData();
                        this.refreshUI();
                    }
                } catch (e) { this.toast('Gagal menghapus.', 'error'); }
            }
        });
    },

    syncDragDrop: function(event) {
        const item = event.extendedProps;
        const payload = {
            id: item['ID (UUID)'], 
            tipe: item.Tipe || 'Internal',
            deskripsi: item['Deskripsi Kegiatan'] || '',
            unit: item.Unit, 
            nama_kegiatan: item['Nama Kegiatan'],
            tanggal_mulai: event.start.toISOString().split('T')[0],
            tanggal_selesai: event.end ? new Date(event.end.getTime() - 86400000).toISOString().split('T')[0] : event.start.toISOString().split('T')[0],
            pic: item.PIC
        };

        fetch(GAS_WEB_APP_URL, {
            method: 'POST', body: JSON.stringify({ action: 'update', payload: payload })
        }).then(res => res.json()).then(() => {
            this.toast('Waktu berhasil disesuaikan', 'info');
            this.loadData().then(() => this.refreshUI());
        });
    },

    handleCsvUpload: function(file) {
        if (typeof Papa === 'undefined') {
            this.toast('Library CSV belum termuat sempurna.', 'error');
            return;
        }

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const data = results.data;
                if (data.length === 0) {
                    this.toast('File CSV kosong', 'warning');
                    return;
                }

                // Header harus mengandung: Tipe Kegiatan, Unit, Nama Kegiatan, Tanggal Mulai, Tanggal Selesai, PIC, Deskripsi (opsional)
                const requiredHeaders = ['Tipe Kegiatan', 'Unit', 'Nama Kegiatan', 'Tanggal Mulai', 'Tanggal Selesai', 'PIC'];
                const fileHeaders = Object.keys(data[0]);
                const isValid = requiredHeaders.every(h => fileHeaders.includes(h));

                if (!isValid) {
                    Swal.fire('Format Salah', 'Pastikan header CSV memiliki kolom: Tipe Kegiatan, Unit, Nama Kegiatan, Tanggal Mulai, Tanggal Selesai, PIC', 'error');
                    return;
                }

                this.processBulkImport(data);
            },
            error: () => {
                this.toast('Gagal membaca file CSV', 'error');
            }
        });
    },

    processBulkImport: async function(dataList) {
        const total = dataList.length;
        let successCount = 0;
        let errorCount = 0;

        Swal.fire({
            title: 'Mengimpor Data...',
            html: `
                <div class="mb-3">Menyinkronkan dengan Google Calendar...</div>
                <div class="progress" style="height: 25px;">
                    <div id="import-progress" class="progress-bar progress-bar-striped progress-bar-animated bg-primary" role="progressbar" style="width: 0%; font-weight: bold;">0%</div>
                </div>
                <div class="mt-2 small text-muted" id="import-status">Memproses 0 dari ${total}</div>
            `,
            allowOutsideClick: false, allowEscapeKey: false, showConfirmButton: false
        });

        for (let i = 0; i < total; i++) {
            const row = dataList[i];
            const payload = {
                id: "", 
                tipe: row['Tipe Kegiatan'] === 'Eksternal' ? 'Eksternal' : 'Internal',
                deskripsi: row['Deskripsi'] || '',
                unit: row['Unit'],
                nama_kegiatan: row['Nama Kegiatan'],
                tanggal_mulai: row['Tanggal Mulai'],
                tanggal_selesai: row['Tanggal Selesai'],
                pic: row['PIC']
            };

            try {
                const response = await fetch(GAS_WEB_APP_URL, {
                    method: 'POST',
                    body: JSON.stringify({ action: 'add', payload: payload })
                });
                const result = await response.json();
                
                if (result.status === 'success') successCount++;
                else errorCount++;
            } catch (error) {
                errorCount++;
            }

            const percent = Math.round(((i + 1) / total) * 100);
            $('#import-progress').css('width', percent + '%').text(percent + '%');
            $('#import-status').text(`Memproses ${i + 1} dari ${total}`);
        }

        Swal.fire({
            title: 'Impor Selesai!',
            html: `Berhasil ditambahkan: <b>${successCount}</b><br>Gagal / Duplikat: <b>${errorCount}</b>`,
            icon: errorCount > 0 ? 'warning' : 'success',
            confirmButtonText: 'Selesai'
        }).then(() => {
            this.loadData().then(() => this.refreshUI());
        });
    },

    toast: function(message, icon) {
        Swal.fire({ title: message, icon: icon, toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
    }
};

$(document).ready(() => app.init());