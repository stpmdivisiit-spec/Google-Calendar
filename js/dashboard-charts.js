const DashboardAnalytics = {
    barChartInstance: null,
    doughnutChartInstance: null,
    picBarChartInstance: null,
    dayOfWeekChartInstance: null,
    avgDurationChartInstance: null,

    init: function(data) {
        if (typeof feather !== 'undefined') feather.replace();
        
        this.populateCounters(data);
        this.renderHeatmap(data); // Render Heatmap dipisah agar lebih aman
        this.renderCharts(data);
        this.detectConflicts(data);
    },

    populateCounters: function(data) {
        try {
            const currentDate = new Date();
            const currentMonth = currentDate.getMonth();
            const currentYear = currentDate.getFullYear();

            $('#stat-total').text(data.length);
            const futureCount = data.filter(d => new Date(d['Tanggal Mulai']) >= currentDate).length;
            $('#stat-upcoming').text(futureCount);

            const thisMonthData = data.filter(d => {
                const dDate = new Date(d['Tanggal Mulai']);
                return !isNaN(dDate.getTime()) && dDate.getMonth() === currentMonth && dDate.getFullYear() === currentYear;
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
        } catch (e) { console.error("Error populateCounters:", e); }
    },

    detectConflicts: function(data) {
        try {
            let conflicts = [];
            let conflictingEventIds = new Set();
            
            for (let i = 0; i < data.length; i++) {
                for (let j = i + 1; j < data.length; j++) {
                    let start1 = new Date(data[i]['Tanggal Mulai']).getTime();
                    let end1 = new Date(data[i]['Tanggal Selesai']).getTime();
                    let start2 = new Date(data[j]['Tanggal Mulai']).getTime();
                    let end2 = new Date(data[j]['Tanggal Selesai']).getTime();

                    if (!isNaN(start1) && !isNaN(end1) && !isNaN(start2) && !isNaN(end2)) {
                        // Rumus mendeteksi irisan tanggal
                        if (start1 <= end2 && start2 <= end1) {
                            conflicts.push({ eventA: data[i], eventB: data[j] });
                            
                            // Gunakan UUID, jika kosong gunakan kombinasi nama + index sebagai ID unik
                            const idA = data[i]['ID (UUID)'] || (data[i]['Nama Kegiatan'] + i);
                            const idB = data[j]['ID (UUID)'] || (data[j]['Nama Kegiatan'] + j);
                            
                            conflictingEventIds.add(idA);
                            conflictingEventIds.add(idB);
                        }
                    }
                }
            }

            $('#stat-conflicts').text(conflicts.length);
            $('#badge-conflict-count').text(conflicts.length);

            // Perbaikan Kalkulasi Persentase Tabrakan
            const conflictRate = data.length > 0 ? ((conflictingEventIds.size / data.length) * 100).toFixed(1) : 0;
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
        } catch (e) { console.error("Error detectConflicts:", e); }
    },

    renderHeatmap: function(data) {
        try {
            const container = $('#heatmap-container');
            if (container.length === 0) return;
            container.empty();

            const heatData = Array.from({length: 7}, () => new Array(12).fill(0));
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
            const dayLabels = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

            data.forEach(d => {
                const dt = new Date(d['Tanggal Mulai']);
                if (!isNaN(dt.getTime())) {
                    const m = dt.getMonth();
                    let day = dt.getDay() - 1; 
                    if (day === -1) day = 6; // Menggeser Minggu ke urutan terakhir
                    heatData[day][m]++;
                }
            });

            let maxVal = 1;
            heatData.forEach(row => row.forEach(val => { if(val > maxVal) maxVal = val; }));

            let html = '<div style="display:flex; flex-direction:column; gap:6px; overflow-x:auto; padding:10px 0;">';
            
            // Render Header Bulan
            html += '<div style="display:flex; gap:6px; margin-left: 36px;">';
            monthNames.forEach(m => {
                html += `<div style="width: 38px; text-align:center; font-size:11px; color:#6c757d; font-weight:bold;">${m}</div>`;
            });
            html += '</div>';

            // Render Kotak Heatmap
            for (let r = 0; r < 7; r++) {
                html += '<div style="display:flex; gap:6px; align-items:center;">';
                html += `<div style="width: 30px; font-size:11px; color:#6c757d; text-align:right; padding-right:4px; font-weight:bold;">${dayLabels[r]}</div>`;
                
                for (let c = 0; c < 12; c++) {
                    const val = heatData[r][c];
                    let levelClass = 'heatmap-empty';
                    
                    if (val > 0) {
                        const ratio = val / maxVal;
                        if (ratio > 0.75) levelClass = 'heatmap-high';
                        else if (ratio > 0.40) levelClass = 'heatmap-medium';
                        else levelClass = 'heatmap-low';
                    }

                    html += `<div class="heatmap-box ${levelClass}" title="${val} Kegiatan di hari ${dayLabels[r]}, Bulan ${monthNames[c]}">
                                  ${val > 0 ? val : ''}
                             </div>`;
                }
                html += '</div>';
            }
            html += '</div>';
            
            container.html(html);
        } catch (e) { console.error("Error renderHeatmap:", e); }
    },

    renderCharts: function(data) {
        const unitMap = {};
        const timeMap = {};
        const picDetailsMap = {}; 
        const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0]; 
        const unitDurationSum = {};
        const unitDurationCount = {};
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

        data.forEach(d => {
            const startDt = new Date(d['Tanggal Mulai']);
            const endDt = new Date(d['Tanggal Selesai']);

            if (!isNaN(startDt.getTime())) {
                unitMap[d.Unit] = (unitMap[d.Unit] || 0) + 1;
                
                if (!picDetailsMap[d.PIC]) picDetailsMap[d.PIC] = [];
                picDetailsMap[d.PIC].push({ nama: d['Nama Kegiatan'], tanggal: d['Tanggal Mulai'] });

                const dayIdx = startDt.getDay();
                dayOfWeekCounts[dayIdx]++;

                const year = startDt.getFullYear();
                const month = String(startDt.getMonth() + 1).padStart(2, '0');
                const key = `${year}-${month}`; 
                timeMap[key] = (timeMap[key] || 0) + 1;

                if (!isNaN(endDt.getTime())) {
                    const durationDays = Math.max(1, Math.round((endDt - startDt) / (1000 * 60 * 60 * 24)) + 1);
                    unitDurationSum[d.Unit] = (unitDurationSum[d.Unit] || 0) + durationDays;
                    unitDurationCount[d.Unit] = (unitDurationCount[d.Unit] || 0) + 1;
                }
            }
        });

        // Re-order Hari Kerja: Senin - Minggu
        const orderedDayCounts = [
            dayOfWeekCounts[1], dayOfWeekCounts[2], dayOfWeekCounts[3],
            dayOfWeekCounts[4], dayOfWeekCounts[5], dayOfWeekCounts[6], dayOfWeekCounts[0]
        ];

        // Mencegah array kosong pada Rata-Rata Durasi
        let avgDurationLabels = Object.keys(unitDurationSum);
        let avgDurationValues = avgDurationLabels.map(u => (unitDurationSum[u] / unitDurationCount[u]).toFixed(1));
        if (avgDurationLabels.length === 0) {
            avgDurationLabels = ['Belum Ada Data'];
            avgDurationValues = [0];
        }

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

        // Destroy Chart Lama
        if (this.barChartInstance) this.barChartInstance.destroy();
        if (this.doughnutChartInstance) this.doughnutChartInstance.destroy();
        if (this.picBarChartInstance) this.picBarChartInstance.destroy();
        if (this.dayOfWeekChartInstance) this.dayOfWeekChartInstance.destroy();
        if (this.avgDurationChartInstance) this.avgDurationChartInstance.destroy();

        // 1. Bar Chart - Trend Tahunan
        try {
            const ctxBar = document.getElementById('barChart');
            if (ctxBar && timeLabels.length > 0) {
                this.barChartInstance = new Chart(ctxBar, {
                    type: 'bar',
                    data: { labels: timeLabels, datasets: [{ label: 'Total Kegiatan', data: timeData, backgroundColor: primaryColor, borderRadius: 4 }] },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
                });
            }
        } catch (e) { console.error("Error BarChart:", e); }

        // 2. Doughnut Chart - Proporsi Unit
        try {
            const ctxDoughnut = document.getElementById('doughnutChart');
            if (ctxDoughnut && Object.keys(unitMap).length > 0) {
                this.doughnutChartInstance = new Chart(ctxDoughnut, {
                    type: 'doughnut',
                    data: { labels: Object.keys(unitMap), datasets: [{ data: Object.values(unitMap), backgroundColor: bgColors.slice(0, Object.keys(unitMap).length) }] },
                    options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } } }
                });
            }
        } catch (e) { console.error("Error DoughnutChart:", e); }

        // 3. Bar Chart (Dulu Radar) - Distribusi Hari Kerja
        // Diubah menjadi Bar Chart Vertikal agar 100% stabil di semua versi browser
        try {
            const ctxDay = document.getElementById('dayOfWeekChart');
            if (ctxDay) {
                this.dayOfWeekChartInstance = new Chart(ctxDay, {
                    type: 'bar',
                    data: {
                        labels: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'],
                        datasets: [{
                            label: 'Jumlah Kegiatan',
                            data: orderedDayCounts,
                            backgroundColor: '#6f42c1',
                            borderRadius: 4
                        }]
                    },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
                });
            }
        } catch (e) { console.error("Error DayOfWeekChart:", e); }

        // 4. Bar Chart - Rata-rata Durasi Kegiatan
        try {
            const ctxAvg = document.getElementById('avgDurationChart');
            if (ctxAvg) {
                this.avgDurationChartInstance = new Chart(ctxAvg, {
                    type: 'bar',
                    data: {
                        labels: avgDurationLabels.map(u => u.split(' ').slice(0, 2).join(' ')),
                        datasets: [{ label: 'Rata-rata Durasi (Hari)', data: avgDurationValues, backgroundColor: '#198754', borderRadius: 4 }]
                    },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
                });
            }
        } catch (e) { console.error("Error AvgDurationChart:", e); }

        // 5. Horizontal Bar Chart - PIC Workload
        try {
            const ctxPic = document.getElementById('picBarChart');
            if (ctxPic && Object.keys(picDetailsMap).length > 0) {
                const sortedPIC = Object.keys(picDetailsMap).sort((a,b) => picDetailsMap[b].length - picDetailsMap[a].length).slice(0, 10);
                const sortedPICData = sortedPIC.map(pic => picDetailsMap[pic].length);
                const shortLabels = sortedPIC.map(pic => pic.split(' ').slice(0, 2).join(' '));

                this.picBarChartInstance = new Chart(ctxPic, {
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
                                        for(let i = 0; i < events.length; i++) {
                                            if (i >= 10) {
                                                lines.push(`... dan ${events.length - 10} lainnya.`);
                                                lines.push(`(👉 Klik batang ini untuk filter Tabel)`);
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
                                        icon: 'info', title: `Tabel difilter khusus untuk:\n${fullPicName}`
                                    });
                                }, 250);
                            }
                        }
                    }
                });
            }
        } catch (e) { console.error("Error PicBarChart:", e); }
    }
};