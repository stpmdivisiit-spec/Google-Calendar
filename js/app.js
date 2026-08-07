const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxb_eQbMQtpR3sS6IZiMLqcIzOjtzB2RZ9CSIDr6Yn9UHdTUw4XIw-nwsOIpXK8xLYucg/exec'; 

const app = {
    eventsData: [], table: null, calendar: null,

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
            e.preventDefault(); $('body').toggleClass('sb-sidenav-toggled');
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
    },

    setupPlugins: function() {
        $('.select2').select2({ theme: 'bootstrap-5', dropdownParent: $('#kegiatanModal') });
        
        // PENGATURAN BARU FLATPICKR: Hilangkan deteksi Jam/Waktu
        $('.flatpickr-date').flatpickr({
            enableTime: false,
            dateFormat: "Y-m-d"
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

    // Fungsi Bantuan Baru: Memformat tanggal agar menjadi blok warna penuh (All Day)
    formatEventsForCalendar: function(data) {
        return data.map(item => {
            // Konversi ke objek Date
            const startDate = new Date(item['Tanggal Mulai']);
            const endDate = new Date(item['Tanggal Selesai']);
            
            // FULLCALENDAR FIX: Tambahkan 1 hari ke Tanggal Selesai agar blok warna dirender hingga akhir hari
            const exclusiveEndDate = new Date(endDate);
            exclusiveEndDate.setDate(exclusiveEndDate.getDate() + 1);

            // Ekstrak hanya YYYY-MM-DD
            const startStr = startDate.toISOString().split('T')[0];
            const endStr = exclusiveEndDate.toISOString().split('T')[0];

            return {
                id: item['ID (UUID)'],
                title: `[${item.Unit}] ${item['Nama Kegiatan']}`,
                start: startStr,
                end: endStr,
                allDay: true, // Memaksa FullCalendar menjadikannya blok warna solid, tanpa teks jam
                backgroundColor: this.getUnitColorCode(item.Unit),
                borderColor: this.getUnitColorCode(item.Unit),
                textColor: '#ffffff',
                extendedProps: item
            };
        });
    },

    initCalendar: function() {
        const calElement = document.getElementById('calendar');
        const formattedEvents = this.formatEventsForCalendar(this.eventsData);

        this.calendar = new FullCalendar.Calendar(calElement, {
            // HAPUS themeSystem: 'bootstrap5' agar kita bisa mendesainnya bergaya Google Calendar
            initialView: 'dayGridMonth',
            firstDay: 0, // 0 = Minggu, 1 = Senin (Menyesuaikan Google Calendar)
            headerToolbar: {
                left: 'today prev,next',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay' // Sesuaikan gaya minimalis
            },
            buttonText: { today: 'Hari ini', month: 'Bulan', week: 'Minggu', day: 'Hari' },
            events: formattedEvents,
            editable: true,
            droppable: true,
            selectable: true,
            dayMaxEvents: true, // Akan memunculkan "more..." jika kegiatan menumpuk di 1 hari
            
            dateClick: (info) => {
                this.openModal();
                $('#tanggal_mulai').val(info.dateStr);
            },
            eventClick: (info) => { this.editEvent(info.event.id); },
            eventDrop: (info) => { this.syncDragDrop(info.event); },
            eventResize: (info) => { this.syncDragDrop(info.event); }
        });
    },





initDataTables: function() {
        this.table = $('#dataTable').DataTable({
            data: this.eventsData,
            responsive: true,
            scrollX: true,
            // Mengatur tata letak elemen tabel (Tombol, Pencarian, Pagination)
            dom: '<"row align-items-center mb-3"<"col-sm-12 col-md-6"B><"col-sm-12 col-md-6 d-flex justify-content-md-end"f>>rt<"row align-items-center mt-3"<"col-sm-12 col-md-5"i><"col-sm-12 col-md-7 d-flex justify-content-md-end"p>>',
            
            // Pengaturan Tombol Export dengan warna yang sesuai tema
            buttons: [
                { extend: 'copy', text: '<i class="fas fa-copy me-1"></i> Copy', className: 'btn btn-sm btn-outline-primary mb-2' },
                { extend: 'excel', text: '<i class="fas fa-file-excel me-1"></i> Excel', className: 'btn btn-sm btn-outline-success mb-2' },
                { extend: 'pdf', text: '<i class="fas fa-file-pdf me-1"></i> PDF', className: 'btn btn-sm btn-outline-danger mb-2' },
                { extend: 'print', text: '<i class="fas fa-print me-1"></i> Print', className: 'btn btn-sm btn-outline-secondary mb-2' }
            ],
            
            // Pengaturan Kolom (Disesuaikan menjadi 7 Kolom)
            columns: [
                { data: null, className: 'text-center', render: (d, t, r, meta) => meta.row + 1 },
                { data: 'Unit' },
                { data: 'Nama Kegiatan', className: 'fw-bold text-dark' },
                { 
                    data: 'Tanggal Mulai', 
                    render: data => {
                        if(!data) return '-';
                        // Memaksa format hanya menampilkan tanggal (contoh: 8 Agu 2026)
                        return new Date(data).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                    }
                },
                { 
                    data: 'Tanggal Selesai', 
                    render: data => {
                        if(!data) return '-';
                        return new Date(data).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                    }
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
            ]
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
        $('.select2').val('').trigger('change');
        $('#kegiatanModal').modal('show');
    },

    editEvent: function(id) {
        const item = this.eventsData.find(d => d['ID (UUID)'] === id);
        if (!item) return;
        
        $('#event_id').val(item['ID (UUID)']);
        $('#unit').val(item.Unit).trigger('change');
        $('#pic').val(item.PIC).trigger('change');
        $('#nama_kegiatan').val(item['Nama Kegiatan']);
        
        // Format hanya Tanggal YYYY-MM-DD
        const formatDate = (isoString) => {
            const dt = new Date(isoString);
            const pad = (n) => n.toString().padStart(2, '0');
            return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`;
        };

        $('#tanggal_mulai').val(formatDate(item['Tanggal Mulai']));
        $('#tanggal_selesai').val(formatDate(item['Tanggal Selesai']));
        
        $('#kegiatanModal').modal('show');
    },




saveEvent: function() {
        // 1. Ambil data dari form
        const payload = {
            id: $('#event_id').val(),
            unit: $('#unit').val(),
            nama_kegiatan: $('#nama_kegiatan').val(),
            tanggal_mulai: $('#tanggal_mulai').val(),
            tanggal_selesai: $('#tanggal_selesai').val(),
            pic: $('#pic').val()
        };

        const action = payload.id ? 'update' : 'add';
        const btn = $('#btnSave');

        // 2. Logika Deteksi Tabrakan Jadwal (Overlap Detection)
        const newStart = new Date(payload.tanggal_mulai).getTime();
        const newEnd = new Date(payload.tanggal_selesai).getTime();
        let conflictingEvents = [];

        // Cek data yang ada di memori lokal
        this.eventsData.forEach(event => {
            // Jangan periksa tabrakan dengan dirinya sendiri jika sedang dalam mode "Edit"
            if (payload.id && event['ID (UUID)'] === payload.id) return;

            const existStart = new Date(event['Tanggal Mulai']).getTime();
            const existEnd = new Date(event['Tanggal Selesai']).getTime();

            // Rumus mendeteksi irisan tanggal (Start A <= End B DAN Start B <= End A)
            if (newStart <= existEnd && existStart <= newEnd) {
                conflictingEvents.push(`• <b>${event['Nama Kegiatan']}</b> <span class="text-primary">(${event.Unit})</span>`);
            }
        });

        // 3. Tampilkan Pop-up jika ada tabrakan
        if (conflictingEvents.length > 0) {
            Swal.fire({
                title: '⚠️ Peringatan Tabrakan Jadwal',
                html: `
                    <div class="text-start mb-2">Tanggal kegiatan ini berbenturan dengan kegiatan berikut:</div>
                    <div class="text-start bg-light p-2 rounded mb-3" style="max-height: 120px; overflow-y: auto; font-size: 0.9rem;">
                        ${conflictingEvents.join('<br>')}
                    </div>
                    <div class="text-start">Apakah Anda yakin ingin tetap menyimpannya? Anda bisa mengeditnya lagi nanti.</div>
                `,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#0d6efd',
                cancelButtonColor: '#6c757d',
                confirmButtonText: '<i class="fas fa-save me-1"></i> Ya, Tetap Simpan',
                cancelButtonText: 'Batal',
                reverseButtons: true // Memindahkan tombol Batal ke kiri
            }).then((result) => {
                if (result.isConfirmed) {
                    // Jika pengguna memaksa simpan, eksekusi penyimpanan ke server
                    this.executeSaveToServer(action, payload, btn);
                }
            });
        } else {
            // Jika tidak ada tabrakan, langsung simpan tanpa peringatan
            this.executeSaveToServer(action, payload, btn);
        }
    },

    // Fungsi terpisah untuk melakukan pengiriman data ke Google Apps Script
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
                
                // Minta data terbaru dari server & gambar ulang UI (TANPA RELOAD HALAMAN)
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
            id: item['ID (UUID)'], unit: item.Unit, nama_kegiatan: item['Nama Kegiatan'],
            tanggal_mulai: event.start.toISOString().split('T')[0], // Split untuk mengambil tanggalnya saja
            tanggal_selesai: event.end ? event.end.toISOString().split('T')[0] : event.start.toISOString().split('T')[0],
            pic: item.PIC
        };

        fetch(GAS_WEB_APP_URL, {
            method: 'POST', body: JSON.stringify({ action: 'update', payload: payload })
        }).then(res => res.json()).then(() => {
            this.toast('Waktu berhasil disesuaikan', 'info');
            this.loadData().then(() => this.refreshUI());
        });
    },

    toast: function(message, icon) {
        Swal.fire({ title: message, icon: icon, toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
    }
};

$(document).ready(() => app.init());