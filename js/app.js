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
            const formattedEvents = this.eventsData.map(item => ({
                id: item['ID (UUID)'],
                title: `[${item.Unit}] ${item['Nama Kegiatan']}`,
                start: item['Tanggal Mulai'], // Format baru Date only
                end: item['Tanggal Selesai'],
                backgroundColor: this.getUnitColorCode(item.Unit),
                extendedProps: item
            }));
            this.calendar.removeAllEvents();
            this.calendar.addEventSource(formattedEvents);
        }
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
            // PENGATURAN BARU KOLOM: Sesuaikan penghapusan status, lokasi, dll.
            columns: [
                { data: null, className: 'text-center', render: (d, t, r, meta) => meta.row + 1 },
                { data: 'Unit' },
                { data: 'Nama Kegiatan', className: 'fw-500' },
                { data: 'Tanggal Mulai', render: data => new Date(data).toLocaleDateString('id-ID', {dateStyle: 'medium'}) },
                { data: 'Tanggal Selesai', render: data => new Date(data).toLocaleDateString('id-ID', {dateStyle: 'medium'}) },
                { data: 'PIC' },
                { data: 'ID (UUID)', className: 'text-center', render: id => `
                    <div class="d-flex justify-content-center gap-2">
                        <button class="btn btn-datatable btn-icon btn-transparent-dark" onclick="app.editEvent('${id}')" title="Edit"><i data-feather="edit-2"></i></button>
                        <button class="btn btn-datatable btn-icon btn-transparent-dark text-danger" onclick="app.deleteEvent('${id}')" title="Hapus"><i data-feather="trash-2"></i></button>
                    </div>
                `}
            ],
            drawCallback: function() { if (typeof feather !== 'undefined') feather.replace(); }
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
                $('#tanggal_mulai').val(info.dateStr); // Cukup Set Tanggal saja
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

    saveEvent: async function() {
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