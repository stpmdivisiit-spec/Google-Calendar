const DashboardAnalytics = {
    barChartInstance: null,
    doughnutChartInstance: null,
    picBarChartInstance: null,

    init: function(data) {
        if (typeof feather !== 'undefined') feather.replace();
        
        this.populateCounters(data);
        this.renderCharts(data);
        this.detectConflicts(data);
    },

    populateCounters: function(data) {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();

        $('#stat-total').text(data.length);
        const futureCount = data.filter(d => new Date(d['Tanggal Mulai']) >= currentDate).length;
        $('#stat-upcoming').text(futureCount);

        const thisMonthData = data.filter(d => {
            const dDate = new Date(d['Tanggal Mulai']);
            return dDate.getMonth() === currentMonth && dDate.getFullYear() === currentYear;
        });
        $('#stat-month').text(thisMonthData.length);

        const unitFreq = {};
        thisMonthData.forEach(d => { unitFreq[d.Unit] = (unitFreq[d.Unit] || 0) + 1; });
        const topUnit = Object.keys(unitFreq).sort((a,b) => unitFreq[b] - unitFreq[a])[0];
        $('#stat-busiest-unit').text(topUnit || 'Belum Ada Data');

        const picFreq = {};
        thisMonthData.forEach(d => { picFreq[d.PIC] = (picFreq[d.PIC] || 0) + 1; });
        const topPIC = Object.keys(picFreq).sort((a,b) => picFreq[b] - picFreq[a])[0];
        $('#stat-busiest-pic').text(topPIC ? topPIC.split(',')[0] : 'Belum Ada Data');
    },

    detectConflicts: function(data) {
        let conflicts = [];
        
        for (let i = 0; i < data.length; i++) {
            for (let j = i + 1; j < data.length; j++) {
                let start1 = new Date(data[i]['Tanggal Mulai']).getTime();
                let end1 = new Date(data[i]['Tanggal Selesai']).getTime();
                let start2 = new Date(data[j]['Tanggal Mulai']).getTime();
                let end2 = new Date(data[j]['Tanggal Selesai']).getTime();

                if (start1 <= end2 && start2 <= end1) {
                    conflicts.push({ eventA: data[i], eventB: data[j] });
                }
            }
        }

        $('#stat-conflicts').text(conflicts.length);
        $('#badge-conflict-count').text(conflicts.length);

        const listContainer = $('#conflict-list');
        listContainer.empty();

        if (conflicts.length === 0) {
            listContainer.append('<div class="p-4 text-center text-muted small"><i class="fas fa-check-circle text-success me-2"></i>Jadwal aman, tidak ada kegiatan yang bertabrakan.</div>');
        } else {
            conflicts.forEach(c => {
                const dateStr = new Date(c.eventA['Tanggal Mulai']).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
                listContainer.append(`
                    <div class="list-group-item list-group-item-action">
                        <div class="d-flex w-100 justify-content-between mb-1">
                            <h6 class="mb-0 fw-bold text-danger">⚠️ Tabrakan Terdeteksi</h6>
                            <small class="text-muted fw-bold">${dateStr}</small>
                        </div>
                        <div class="small mb-1"><b>1.</b> ${c.eventA['Nama Kegiatan']} <span class="text-primary">(${c.eventA.Unit})</span></div>
                        <div class="small"><b>2.</b> ${c.eventB['Nama Kegiatan']} <span class="text-primary">(${c.eventB.Unit})</span></div>
                    </div>
                `);
            });
        }
    },

    renderCharts: function(data) {
        const unitMap = {};
        const timeMap = {};
        
        // PENGATURAN BARU: Menyimpan Detail Kegiatan per PIC, bukan hanya angkanya saja
        const picDetailsMap = {}; 
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

        data.forEach(d => {
            unitMap[d.Unit] = (unitMap[d.Unit] || 0) + 1;
            
            // Simpan detail untuk Tooltip PIC
            if (!picDetailsMap[d.PIC]) picDetailsMap[d.PIC] = [];
            picDetailsMap[d.PIC].push({
                nama: d['Nama Kegiatan'],
                tanggal: d['Tanggal Mulai']
            });

            const date = new Date(d['Tanggal Mulai']);
            if (!isNaN(date.getTime())) {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const key = `${year}-${month}`; 
                timeMap[key] = (timeMap[key] || 0) + 1;
            }
        });

        // Pengaturan Label Waktu (Trend Tahunan)
        const sortedTimeKeys = Object.keys(timeMap).sort();
        const timeLabels = [];
        const timeData = [];

        sortedTimeKeys.forEach(key => {
            const parts = key.split('-');
            const year = parts[0];
            const monthIndex = parseInt(parts[1], 10) - 1;
            timeLabels.push(`${monthNames[monthIndex]} ${year}`);
            timeData.push(timeMap[key]);
        });

        const primaryColor = 'rgba(13, 110, 253, 0.85)';
        const bgColors = ['#0d6efd', '#dc3545', '#6f42c1', '#198754', '#0dcaf0', '#fd7e14', '#ffc107', '#20c997', '#e83e8c', '#6610f2', '#d63384'];

        if (this.barChartInstance) this.barChartInstance.destroy();
        if (this.doughnutChartInstance) this.doughnutChartInstance.destroy();
        if (this.picBarChartInstance) this.picBarChartInstance.destroy();

        // 1. Bar Chart - Trend Tahunan Dinamis
        this.barChartInstance = new Chart(document.getElementById('barChart'), {
            type: 'bar',
            data: {
                labels: timeLabels, 
                datasets: [{ label: 'Total Kegiatan', data: timeData, backgroundColor: primaryColor, borderRadius: 4 }]
            },
            options: { 
                responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
            }
        });

        // 2. Doughnut Chart - Proporsi Unit
        this.doughnutChartInstance = new Chart(document.getElementById('doughnutChart'), {
            type: 'doughnut',
            data: {
                labels: Object.keys(unitMap),
                datasets: [{ data: Object.values(unitMap), backgroundColor: bgColors.slice(0, Object.keys(unitMap).length) }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '65%',
                plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } }
            }
        });

        // 3. Horizontal Bar Chart - Beban Kerja PIC Terperinci
        // Urutkan PIC berdasarkan total kegiatan terbanyak
        const sortedPIC = Object.keys(picDetailsMap).sort((a,b) => picDetailsMap[b].length - picDetailsMap[a].length).slice(0, 10);
        const sortedPICData = sortedPIC.map(pic => picDetailsMap[pic].length);
        const shortLabels = sortedPIC.map(pic => pic.split(' ').slice(0, 2).join(' ')); // Nama Panggilan

        this.picBarChartInstance = new Chart(document.getElementById('picBarChart'), {
            type: 'bar', 
            data: {
                labels: shortLabels,
                datasets: [{ label: 'Total Kegiatan', data: sortedPICData, backgroundColor: '#0dcaf0', borderRadius: 4 }]
            },
            options: {
                indexAxis: 'y', 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        padding: 12,
                        titleFont: { size: 14 },
                        bodyFont: { size: 13 },
                        callbacks: {
                            // Mengganti judul tooltip dengan nama lengkap PIC
                            title: function(context) {
                                return sortedPIC[context[0].dataIndex]; 
                            },
                            // Menambahkan teks "Jumlah Kegiatan: X"
                            label: function(context) {
                                return `Jumlah Kegiatan: ${context.raw}`;
                            },
                            // Menambahkan Rincian Kegiatan di bawah Tooltip
                            afterBody: function(context) {
                                const index = context[0].dataIndex;
                                const picName = sortedPIC[index];
                                const events = picDetailsMap[picName];

                                // Urutkan rincian kegiatan dari yang terdekat
                                events.sort((a,b) => new Date(a.tanggal) - new Date(b.tanggal));

                                let lines = ['', 'Rincian Kegiatan:'];
                                const maxDisplay = 10; // Batasi maksimal 10 di tooltip agar tidak tumpah

                                for(let i = 0; i < events.length; i++) {
                                    if (i >= maxDisplay) {
                                        lines.push(`... dan ${events.length - maxDisplay} kegiatan lainnya.`);
                                        lines.push(`(👉 Klik batang grafik ini untuk melihat selengkapnya di Tabel)`);
                                        break;
                                    }
                                    
                                    const dt = new Date(events[i].tanggal);
                                    const monthYear = `${monthNames[dt.getMonth()]} ${dt.getFullYear()}`;
                                    
                                    // Potong judul jika terlalu panjang
                                    let evtName = events[i].nama;
                                    if(evtName.length > 30) evtName = evtName.substring(0, 27) + '...';

                                    lines.push(`• ${evtName} (${monthYear})`);
                                }
                                return lines;
                            }
                        }
                    }
                },
                scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } },
                
                // FITUR REKOMENDASI: Klik untuk memfilter ke tabel data
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const fullPicName = sortedPIC[index];

                        // 1. Simulasikan klik pada menu sidebar 'Data Kegiatan'
                        $('.menu-link[data-target="table-view"]').trigger('click');

                        // 2. Beri jeda sejenak agar animasi pindah tab selesai, lalu otomatis filter tabelnya
                        setTimeout(() => {
                            const table = $('#dataTable').DataTable();
                            // Kolom ke-6 (index 5) adalah kolom PIC
                            table.column(5).search(fullPicName).draw();

                            // Munculkan notifikasi Toast
                            Swal.fire({
                                toast: true, position: 'top-end', showConfirmButton: false, timer: 5000,
                                icon: 'info', title: `Tabel berhasil difilter khusus untuk PIC:\n${fullPicName}`
                            });
                        }, 250);
                    }
                }
            }
        });
    }
};