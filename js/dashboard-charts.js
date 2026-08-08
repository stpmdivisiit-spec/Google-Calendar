const DashboardAnalytics = {
    barChartInstance: null,
    doughnutChartInstance: null,
    picBarChartInstance: null,
    dayOfWeekChartInstance: null,
    avgDurationChartInstance: null,

    init: function(data) {
        if (typeof feather !== 'undefined') feather.replace();
        
        this.populateCounters(data);
        this.renderCharts(data);
        this.renderHeatmap(data);
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

        // Kalkulasi Tingkat Bentrok Jadwal (%)
        const conflictRate = data.length > 0 ? ((conflicts.length / data.length) * 100).toFixed(1) : 0;
        $('#stat-conflict-rate').text(`${conflictRate}%`);

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

    // RENDER PEAK WORKLOAD HEATMAP MATRIX
    renderHeatmap: function(data) {
        const heatmapContainer = $('#heatmap-container');
        heatmapContainer.empty();

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        const monthCounts = new Array(12).fill(0);

        data.forEach(d => {
            const dt = new Date(d['Tanggal Mulai']);
            if (!isNaN(dt.getTime())) {
                monthCounts[dt.getMonth()]++;
            }
        });

        const maxVal = Math.max(...monthCounts, 1);

        monthNames.forEach((month, idx) => {
            const count = monthCounts[idx];
            let levelClass = 'heatmap-empty';

            if (count > 0) {
                const ratio = count / maxVal;
                if (ratio > 0.6) levelClass = 'heatmap-high';
                else if (ratio > 0.3) levelClass = 'heatmap-medium';
                else levelClass = 'heatmap-low';
            }

            heatmapContainer.append(`
                <div class="heatmap-box ${levelClass}" title="${month}: ${count} Kegiatan">
                    ${month}<br><small style="font-size:0.65rem;">${count}</small>
                </div>
            `);
        });
    },

    renderCharts: function(data) {
        const unitMap = {};
        const timeMap = {};
        const picDetailsMap = {}; 
        const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0]; // Minggu, Senin, Selasa, Rabu, Kamis, Jumat, Sabtu
        const unitDurationSum = {};
        const unitDurationCount = {};

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

        data.forEach(d => {
            unitMap[d.Unit] = (unitMap[d.Unit] || 0) + 1;
            
            if (!picDetailsMap[d.PIC]) picDetailsMap[d.PIC] = [];
            picDetailsMap[d.PIC].push({ nama: d['Nama Kegiatan'], tanggal: d['Tanggal Mulai'] });

            const startDt = new Date(d['Tanggal Mulai']);
            const endDt = new Date(d['Tanggal Selesai']);

            if (!isNaN(startDt.getTime())) {
                // 1. Distribusi Hari Kerja
                const dayIdx = startDt.getDay();
                dayOfWeekCounts[dayIdx]++;

                // 2. Trend Waktu
                const year = startDt.getFullYear();
                const month = String(startDt.getMonth() + 1).padStart(2, '0');
                const key = `${year}-${month}`; 
                timeMap[key] = (timeMap[key] || 0) + 1;

                // 3. Durasi Kegiatan (Hari)
                if (!isNaN(endDt.getTime())) {
                    const durationDays = Math.max(1, Math.round((endDt - startDt) / (1000 * 60 * 60 * 24)) + 1);
                    unitDurationSum[d.Unit] = (unitDurationSum[d.Unit] || 0) + durationDays;
                    unitDurationCount[d.Unit] = (unitDurationCount[d.Unit] || 0) + 1;
                }
            }
        });

        // Re-order Hari Kerja: [Senin, Selasa, Rabu, Kamis, Jumat, Sabtu, Minggu]
        const orderedDayCounts = [
            dayOfWeekCounts[1], dayOfWeekCounts[2], dayOfWeekCounts[3],
            dayOfWeekCounts[4], dayOfWeekCounts[5], dayOfWeekCounts[6], dayOfWeekCounts[0]
        ];

        // Hitung Rata-rata Durasi per Unit
        const avgDurationLabels = Object.keys(unitDurationSum);
        const avgDurationValues = avgDurationLabels.map(u => (unitDurationSum[u] / unitDurationCount[u]).toFixed(1));

        // Trend Tahunan Sort
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

        // Destroy Instance Lama
        if (this.barChartInstance) this.barChartInstance.destroy();
        if (this.doughnutChartInstance) this.doughnutChartInstance.destroy();
        if (this.picBarChartInstance) this.picBarChartInstance.destroy();
        if (this.dayOfWeekChartInstance) this.dayOfWeekChartInstance.destroy();
        if (this.avgDurationChartInstance) this.avgDurationChartInstance.destroy();

        // 1. Bar Chart - Trend Tahunan
        this.barChartInstance = new Chart(document.getElementById('barChart'), {
            type: 'bar',
            data: { labels: timeLabels, datasets: [{ label: 'Total Kegiatan', data: timeData, backgroundColor: primaryColor, borderRadius: 4 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
        });

        // 2. Doughnut Chart - Proporsi Unit
        this.doughnutChartInstance = new Chart(document.getElementById('doughnutChart'), {
            type: 'doughnut',
            data: { labels: Object.keys(unitMap), datasets: [{ data: Object.values(unitMap), backgroundColor: bgColors.slice(0, Object.keys(unitMap).length) }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } } }
        });

        // 3. Radar Chart - Distribusi Hari Kerja
        this.dayOfWeekChartInstance = new Chart(document.getElementById('dayOfWeekChart'), {
            type: 'radar',
            data: {
                labels: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'],
                datasets: [{
                    label: 'Jumlah Kegiatan',
                    data: orderedDayCounts,
                    backgroundColor: 'rgba(13, 110, 253, 0.2)',
                    borderColor: '#0d6efd',
                    pointBackgroundColor: '#0d6efd'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });

        // 4. Bar Chart - Rata-rata Durasi Kegiatan
        this.avgDurationChartInstance = new Chart(document.getElementById('avgDurationChart'), {
            type: 'bar',
            data: {
                labels: avgDurationLabels.map(u => u.split(' ').slice(0, 2).join(' ')),
                datasets: [{ label: 'Rata-rata Durasi (Hari)', data: avgDurationValues, backgroundColor: '#198754', borderRadius: 4 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
        });

        // 5. Horizontal Bar Chart - PIC Workload
        const sortedPIC = Object.keys(picDetailsMap).sort((a,b) => picDetailsMap[b].length - picDetailsMap[a].length).slice(0, 10);
        const sortedPICData = sortedPIC.map(pic => picDetailsMap[pic].length);
        const shortLabels = sortedPIC.map(pic => pic.split(' ').slice(0, 2).join(' '));

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
                        callbacks: {
                            title: (context) => sortedPIC[context[0].dataIndex],
                            label: (context) => `Jumlah Kegiatan: ${context.raw}`,
                            afterBody: (context) => {
                                const index = context[0].dataIndex;
                                const picName = sortedPIC[index];
                                const events = picDetailsMap[picName];

                                events.sort((a,b) => new Date(a.tanggal) - new Date(b.tanggal));

                                let lines = ['', 'Rincian Kegiatan:'];
                                const maxDisplay = 10;

                                for(let i = 0; i < events.length; i++) {
                                    if (i >= maxDisplay) {
                                        lines.push(`... dan ${events.length - maxDisplay} kegiatan lainnya.`);
                                        lines.push(`(👉 Klik batang grafik ini untuk filter ke Tabel)`);
                                        break;
                                    }
                                    
                                    const dt = new Date(events[i].tanggal);
                                    const monthYear = `${monthNames[dt.getMonth()]} ${dt.getFullYear()}`;
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
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const fullPicName = sortedPIC[index];

                        $('.menu-link[data-target="table-view"]').trigger('click');

                        setTimeout(() => {
                            const table = $('#dataTable').DataTable();
                            table.column(5).search(fullPicName).draw();

                            Swal.fire({
                                toast: true, position: 'top-end', showConfirmButton: false, timer: 5000,
                                icon: 'info', title: `Tabel difilter khusus untuk PIC:\n${fullPicName}`
                            });
                        }, 250);
                    }
                }
            }
        });
    }
};