/**
 * KONFIGURASI UTAMA
 */
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxb_eQbMQtpR3sS6IZiMLqcIzOjtzB2RZ9CSIDr6Yn9UHdTUw4XIw-nwsOIpXK8xLYucg/exec'; 

const app = {
    eventsData: [],
    table: null,
    calendar: null,

    init: async function() {
        this.setupTemplateInteractions();
        this.setupPlugins();
        
        await this.loadData();
        
        $('#app-loader').addClass('d-none');
        $('#app-content').removeClass('d-none');
        
        this.initDataTables();
        this.initCalendar();
        DashboardAnalytics.init(this.eventsData);
    },

    setupTemplateInteractions: function() {
        $('#sidebarToggle').on('click', function(e) {
            e.preventDefault();
            $('body').toggleClass('sb-sidenav-toggled');
        });

        $('#themeToggle').on('click', function() {
            $('body').toggleClass('dark-mode');
            const isDark = $('body').hasClass('dark-mode');
            $(this).html(isDark ? '<i class="fas fa-sun"></i> Mode' : '<i class="fas fa-moon"></i> Mode');
        });

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

        $('#kegiatanForm').on('submit', (e) => {
            e.preventDefault();
            this.saveEvent();
        });

// Trigger Import CSV
        $('#fileCsv').on('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            this.handleCsvUpload(file);
            // Reset input agar file yang sama bisa diupload ulang jika perlu
            $(e.target).val(''); 
        });


    },

    setupPlugins: function() {
        $('.select2').select2({ theme: 'bootstrap-5', dropdownParent: $('#kegiatanModal') });
        $('.flatpickr').flatpickr({ enableTime: true, dateFormat: "Y-m-d H:i", time_24hr: true });
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

    // FUNGSI BARU: Untuk menggambar ulang UI tanpa reload halaman
    refreshUI: function() {
        // 1. Update DataTables
        if (this.table) {
            this.table.clear();
            this.table.rows.add(this.eventsData);
            this.table.draw();
        }

        // 2. Update Calendar
        if (this.calendar) {
            const formattedEvents = this.eventsData.map(item => ({
                id: item['ID (UUID)'],
                title: `[${item.Unit}] ${item['Nama Kegiatan']}`,
                start: item['Tanggal Mulai'],
                end: item['Tanggal Selesai'],
                backgroundColor: this.getUnitColorCode(item.Unit),
                extendedProps: item
            }));
            this.calendar.removeAllEvents();
            this.calendar.addEventSource(formattedEvents);
        }

        // 3. Update Dashboard Charts & Counters
        DashboardAnalytics.populateCounters(this.eventsData);
        DashboardAnalytics.render2DCharts(this.eventsData);
    },

    initDataTables: function() {
        this.table = $('#dataTable').DataTable({
            data: this.eventsData,
            responsive: true,
            dom: '<"row align-items-center mb-3"<"col-sm-12 col-md-6"B><"col-sm-12 col-md-6 d-flex justify-content-md-end"f>>rt<"row align-items-center mt-3"<"col-sm-12 col-md-5"i><"col-sm-12 col-md-7 d-flex justify-content-md-end"p>>',
            buttons: [
                { extend: 'copy', text: '<i class="fas fa-copy me-1"></i> Copy' },
                { extend: 'excel', text: '<i class="fas fa-file-excel me-1"></i> Excel' },
                { extend: 'pdf', text: '<i class="fas fa-file-pdf me-1"></i> PDF' },
                { extend: 'print', text: '<i class="fas fa-print me-1"></i> Print' }
            ],
            columns: [
                { data: null, className: 'text-center', render: (d, t, r, meta) => meta.row + 1 },
                { data: 'Unit' },
                { data: 'Nama Kegiatan', className: 'fw-500' },
                { data: 'Tanggal Mulai', render: data => new Date(data).toLocaleString('id-ID', {dateStyle: 'medium', timeStyle: 'short'}) },
                { data: 'Tanggal Selesai', render: data => new Date(data).toLocaleString('id-ID', {dateStyle: 'medium', timeStyle: 'short'}) },
                { data: 'PIC' },
                { data: 'Lokasi' },
                { data: 'Status', className: 'text-center', render: data => {
                    const bg = {'Perencanaan': 'secondary', 'Berjalan': 'primary', 'Selesai': 'success', 'Ditunda': 'danger'};
                    return `<span class="badge bg-${bg[data]} px-2 py-1">${data}</span>`;
                }},
                { data: 'ID (UUID)', className: 'text-center', render: id => `
                    <div class="d-flex justify-content-center gap-2">
                        <button class="btn btn-datatable btn-icon btn-transparent-dark" onclick="app.editEvent('${id}')" title="Edit"><i data-feather="edit-2"></i></button>
                        <button class="btn btn-datatable btn-icon btn-transparent-dark text-danger" onclick="app.deleteEvent('${id}')" title="Hapus"><i data-feather="trash-2"></i></button>
                    </div>
                `}
            ],
            drawCallback: function() {
                if (typeof feather !== 'undefined') feather.replace();
            }
        });
    },

    initCalendar: function() {
        const calElement = document.getElementById('calendar');
        
        const formattedEvents = this.eventsData.map(item => ({
            id: item['ID (UUID)'],
            title: `[${item.Unit}] ${item['Nama Kegiatan']}`,
            start: item['Tanggal Mulai'],
            end: item['Tanggal Selesai'],
            backgroundColor: this.getUnitColorCode(item.Unit),
            extendedProps: item
        }));

        this.calendar = new FullCalendar.Calendar(calElement, {
            themeSystem: 'bootstrap5',
            initialView: 'dayGridMonth',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
            },
            buttonText: { today: 'Hari Ini', month: 'Bulan', week: 'Minggu', day: 'Hari', list: 'Agenda' },
            events: formattedEvents,
            editable: true,
            droppable: true,
            selectable: true,
            
            dateClick: (info) => {
                this.openModal();
                $('#tanggal_mulai').val(`${info.dateStr} 08:00`);
            },
            eventClick: (info) => { this.editEvent(info.event.id); },
            eventDrop: (info) => { this.syncDragDrop(info.event); },
            eventResize: (info) => { this.syncDragDrop(info.event); }
        });
    },





    handleCsvUpload: function(file) {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const data = results.data;
                if (data.length === 0) {
                    this.toast('File CSV kosong', 'warning');
                    return;
                }

                // Validasi Header (Pastikan format CSV sesuai)
                const requiredHeaders = ['Unit', 'Nama Kegiatan', 'Tanggal Mulai', 'Tanggal Selesai', 'PIC', 'Lokasi', 'Deskripsi', 'Status'];
                const fileHeaders = Object.keys(data[0]);
                const isValid = requiredHeaders.every(h => fileHeaders.includes(h));

                if (!isValid) {
                    Swal.fire('Format Salah', 'Pastikan header CSV memiliki kolom: Unit, Nama Kegiatan, Tanggal Mulai, Tanggal Selesai, PIC, Lokasi, Deskripsi, Status', 'error');
                    return;
                }

                this.processBulkImport(data);
            },
            error: (err) => {
                this.toast('Gagal membaca file CSV', 'error');
            }
        });
    },

    processBulkImport: async function(dataList) {
        const total = dataList.length;
        let successCount = 0;
        let errorCount = 0;

        // Tampilkan Modal Progress Bar
        Swal.fire({
            title: 'Mengimpor Data...',
            html: `
                <div class="mb-3">Mohon jangan tutup halaman ini. Menyinkronkan ke Google Calendar...</div>
                <div class="progress" style="height: 25px;">
                    <div id="import-progress" class="progress-bar progress-bar-striped progress-bar-animated bg-primary" role="progressbar" style="width: 0%; font-weight: bold;">0%</div>
                </div>
                <div class="mt-2 small text-muted" id="import-status">Memproses 0 dari ${total}</div>
            `,
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false
        });

        // Proses data satu per satu untuk mencegah Timeout dan Rate Limit
        for (let i = 0; i < total; i++) {
            const row = dataList[i];
            
            // Format Data
            const payload = {
                id: "", // ID Kosong karena ini data baru (Create)
                unit: row['Unit'],
                nama_kegiatan: row['Nama Kegiatan'],
                tanggal_mulai: row['Tanggal Mulai'],
                tanggal_selesai: row['Tanggal Selesai'],
                pic: row['PIC'],
                lokasi: row['Lokasi'],
                deskripsi: row['Deskripsi'],
                status: row['Status']
            };

            try {
                const response = await fetch(GAS_WEB_APP_URL, {
                    method: 'POST',
                    body: JSON.stringify({ action: 'add', payload: payload })
                });
                const result = await response.json();
                
                if (result.status === 'success') {
                    successCount++;
                } else {
                    errorCount++;
                    console.error("Gagal impor baris " + (i+1) + ":", result.message);
                }
            } catch (error) {
                errorCount++;
                console.error("Network error baris " + (i+1), error);
            }

            // Update Progress Bar
            const percent = Math.round(((i + 1) / total) * 100);
            $('#import-progress').css('width', percent + '%').text(percent + '%');
            $('#import-status').text(`Memproses ${i + 1} dari ${total}`);
        }

        // Selesai
        Swal.fire({
            title: 'Impor Selesai!',
            html: `Berhasil: <b>${successCount}</b><br>Gagal/Duplikat: <b>${errorCount}</b>`,
            icon: errorCount > 0 ? 'warning' : 'success',
            confirmButtonText: 'Tutup & Muat Ulang'
        }).then(() => {
            // Minta data terbaru dari server & gambar ulang UI
            this.loadData().then(() => this.refreshUI());
        });
    },




    getUnitColorCode: function(unit) {
        const colors = {
            'Ketua': '#dc3545', 'Sekretariat': '#0d6efd', 'LP2M': '#198754', 
            'LPM': '#6f42c1', 'Ilmu Pemerintahan': '#fd7e14', 'Pembangunan Sosial': '#0dcaf0'
        };
        return colors[unit] || '#6c757d';
    },

    openModal: function() {
        $('#kegiatanForm')[0].reset();
        $('#event_id').val('');
        $('.select2').val('').trigger('change');
        $('#kegiatanModal').modal('show');
    },

    editEvent: function(id) {
        const item = this.eventsData.find(d => d['ID (UUID)'] === id);
        if (!item) return;
        
        $('#event_id').val(item['ID (UUID)']);
        $('#unit').val(item.Unit).trigger('change');
        $('#nama_kegiatan').val(item['Nama Kegiatan']);
        
        const formatDateTime = (isoString) => {
            const dt = new Date(isoString);
            const pad = (n) => n.toString().padStart(2, '0');
            return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
        };

        $('#tanggal_mulai').val(formatDateTime(item['Tanggal Mulai']));
        $('#tanggal_selesai').val(formatDateTime(item['Tanggal Selesai']));
        $('#pic').val(item.PIC);
        $('#lokasi').val(item.Lokasi);
        $('#deskripsi').val(item.Deskripsi);
        $('#status').val(item.Status);
        
        $('#kegiatanModal').modal('show');
    },

    saveEvent: async function() {
        const payload = {
            id: $('#event_id').val(), unit: $('#unit').val(), nama_kegiatan: $('#nama_kegiatan').val(),
            tanggal_mulai: $('#tanggal_mulai').val(), tanggal_selesai: $('#tanggal_selesai').val(),
            pic: $('#pic').val(), lokasi: $('#lokasi').val(), deskripsi: $('#deskripsi').val(), status: $('#status').val()
        };

        const action = payload.id ? 'update' : 'add';
        const btn = $('#btnSave');
        btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Memproses...');

        try {
            const response = await fetch(GAS_WEB_APP_URL, {
                method: 'POST',
                body: JSON.stringify({ action: action, payload: payload })
            });
            const result = await response.json();
            
            if (result.status === 'success') {
                this.toast('Berhasil disimpan!', 'success');
                $('#kegiatanModal').modal('hide');
                
                // Minta data terbaru dari server & gambar ulang UI (TANPA RELOAD)
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
            title: 'Apakah kamu yakin?',
            text: "Data yang dihapus dari sistem juga akan terhapus secara otomatis di Google Calendar!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Ya, hapus!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const response = await fetch(GAS_WEB_APP_URL, {
                        method: 'POST',
                        body: JSON.stringify({ action: 'delete', id: id })
                    });
                    const res = await response.json();
                    if(res.status === 'success') {
                        this.toast('Data terhapus.', 'success');
                        
                        // Minta data terbaru & update UI
                        await this.loadData();
                        this.refreshUI();
                    }
                } catch (e) {
                    this.toast('Gagal menghapus data.', 'error');
                }
            }
        });
    },

    syncDragDrop: function(event) {
        const item = event.extendedProps;
        const payload = {
            id: item['ID (UUID)'], unit: item.Unit, nama_kegiatan: item['Nama Kegiatan'],
            tanggal_mulai: event.start.toISOString(), tanggal_selesai: event.end ? event.end.toISOString() : event.start.toISOString(),
            pic: item.PIC, lokasi: item.Lokasi, deskripsi: item.Deskripsi, status: item.Status
        };

        fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'update', payload: payload })
        }).then(res => res.json())
          .then(() => {
              this.toast('Waktu berhasil disesuaikan', 'info');
              // Lakukan pembaruan background data di memory
              this.loadData().then(() => this.refreshUI());
          });
    },

    toast: function(message, icon) {
        Swal.fire({
            title: message, icon: icon, toast: true, position: 'top-end',
            showConfirmButton: false, timer: 3000, timerProgressBar: true
        });
    }
};

$(document).ready(() => app.init());