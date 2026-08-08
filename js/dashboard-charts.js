const DashboardAnalytics = {
    barChartInstance: null,
    doughnutChartInstance: null,
    picBarChartInstance: null,
    dayOfWeekChartInstance: null,
    avgDurationChartInstance: null,

    init: function(data) {
        if (typeof feather !== 'undefined') feather.replace();
        
        this.populateCounters(data);
        this.renderCharts(data); // Fungsi renderCharts kini otomatis memanggil renderHeatmap
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
        let conflictingEventIds = new Set(); // Menggunakan Set agar ID kegiatan yang bertabrakan tidak ganda
        
        for (let i = 0; i < data.length; i++) {
            for (let j = i + 1; j < data.length; j++) {
                let start1 = new Date(data[i]['Tanggal Mulai']).getTime();
                let end1 = new Date(data[i]['Tanggal Selesai']).getTime();
                let start2 = new Date(data[j]['Tanggal Mulai']).getTime();
                let end2 = new Date(data[j]['Tanggal Selesai']).getTime();

                if (start1 <= end2 && start2 <= end1) {
                    conflicts.push({ eventA: data[i], eventB: data[j] });
                    conflictingEventIds.add(data[i]['ID (UUID)']);
                    conflictingEventIds.add(data[j]['ID (UUID)']);
                }
            }
        }

        $('#stat-conflicts').text(conflicts.length);
        $('#badge-conflict-count').text(conflicts.length);

        // PERBAIKAN: Hitung rasio kegiatan yang bermasalah secara akurat
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
    },

    renderHeatmap: function(data) {
        const container = $('#heatmap-container');
        if (container.length === 0) return; // Pelindung Error
        container.empty();

        // Buat Grid Kosong: 7 Baris (Hari) x 12 Kolom (Bulan)
        const heatData = Array.from({length: 7}, () => new Array(12).fill(0));
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        const dayLabels = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

        // Distribusikan Data
        data.forEach(d => {
            const dt = new Date(d['Tanggal Mulai']);
            if (!isNaN(dt.getTime())) {
                const m = dt.getMonth();
                let day = dt.getDay() - 1; // getDay() 0 adalah Minggu. Kita ubah agar 0 adalah Senin
                if (day === -1) day = 6; 
                heatData[day][m]++;
            }
        });

        // Cari Nilai Maksimal untuk gradasi warna
        let maxVal = 1;
        heatData.forEach(row => row.forEach(val => { if(val > maxVal) maxVal = val; }));

        // Render HTML dengan CSS Inline (Dijamin muncul tanpa perlu edit style.css)
        let html = '<div style="display:flex; flex-direction:column; gap:4px; overflow-x:auto; padding-bottom:10px;">';
        
        // Render Header Bulan
        html += '<div style="display:flex; gap:4px; margin-left: 30px;">';
        monthNames.forEach(m => {
            html += `<div style="width: 25px; text-align:center; font-size:10px; color:#6c757d; font-weight:bold;">${m}</div>`;
        });
        html += '</div>';

        // Render Baris Hari dan Kotak-Kotaknya
        for (let r = 0; r < 7; r++) {
            html += '<div style="display:flex; gap:4px; align-items:center;">';
            html += `<div style="width: 25px; font-size:10px; color:#6c757d; text-align:right; padding-right:4px; font-weight:bold;">${dayLabels[r]}</div>`;
            
            for (let c = 0; c < 12; c++) {
                const val = heatData[r][c];
                let bgColor = '#ebedf0'; 
                let color = '#adb5bd';
                
                if (val > 0) {
                    const ratio = val / maxVal;
                    if (ratio > 0.75) { bgColor = '#0d6efd'; color = '#ffffff'; } // Tinggi (Biru Tua)
                    else if (ratio > 0.5) { bgColor = '#4293f5'; color = '#ffffff'; } // Sedang (Biru)
                    else if (ratio > 0.25) { bgColor = '#8abdf8'; color = '#000000'; } // Rendah (Biru Muda)
                    else { bgColor = '#cce5ff'; color = '#000000'; } // Sangat Rendah (Pucat)
                }

                // Kotak Heatmap (Hover Effect & Tooltip bawaan)
                html += `<div title="${val} Kegiatan di hari ${dayLabels[r]}, Bulan ${monthNames[c]}" 
                              style="width: 25px; height: 25px; background-color: ${bgColor}; border-radius: 4px; display:flex; align-items:center; justify-content:center; font-size:10px; color:${color}; font-weight:bold; cursor:pointer; transition:all 0.15s ease;" 
                              onmouseover="this.style.transform='scale(1.2)'; this.style.zIndex=10; this.style.boxShadow='0 2px 5px rgba(0,0,0,0.2)';" 
                              onmouseout="this.style.transform='scale(1)'; this.style.zIndex=1; this.style.boxShadow='none';">
                              ${val > 0 ? val : ''}
                         </div>`;
            }
            html += '</div>';
        }
        html += '</div>';
        
        container.html(html);
    },

    renderCharts: function(data) {
        // Panggil renderHeatmap di sini agar otomatis ter-update saat refresh
        this.renderHeatmap(data);

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
                    // Selisih hari + 1 (misal 12 ke 12 = 1 hari)
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

        // 1. Bar Chart - Trend Tahunan (DENGAN PELINDUNG ERROR)
        const ctxBar = document.getElementById('barChart');
        if (ctxBar) {
            this.barChartInstance = new Chart(ctxBar, {
                type: 'bar',
                data: { labels: timeLabels, datasets: [{ label: 'Total Kegiatan', data: timeData, backgroundColor: primaryColor, borderRadius: 4 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
            });
        }

        // 2. Doughnut Chart - Proporsi Unit (DENGAN PELINDUNG ERROR)
        const ctxDoughnut = document.getElementById('doughnutChart');
        if (ctxDoughnut) {
            this.doughnutChartInstance = new Chart(ctxDoughnut, {
                type: 'doughnut',
                data: { labels: Object.keys(unitMap), datasets: [{ data: Object.values(unitMap), backgroundColor: bgColors.slice(0, Object.keys(unitMap).length) }] },
                options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } } }
            });
        }

        // 3. Radar Chart - Distribusi Hari Kerja (DENGAN PELINDUNG ERROR)
        const ctxDay = document.getElementById('dayOfWeekChart');
        if (ctxDay) {
            this.dayOfWeekChartInstance = new Chart(ctxDay, {
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
        }

        // 4. Bar Chart - Rata-rata Durasi Kegiatan (DENGAN PELINDUNG ERROR)
        const ctxAvg = document.getElementById('avgDurationChart');
        if (ctxAvg) {
            this.avgDurationChartInstance = new Chart(ctxAvg, {
                type: 'bar',
                data: {
                    labels: avgDurationLabels.map(u => u.split(' ').slice(0, 2).join(' ')), // Nama Unit Singkat
                    datasets: [{ label: 'Rata-rata Durasi (Hari)', data: avgDurationValues, backgroundColor: '#198754', borderRadius: 4 }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
            });
        }

        // 5. Horizontal Bar Chart - PIC Workload (DENGAN PELINDUNG ERROR)
        const ctxPic = document.getElementById('picBarChart');
        if (ctxPic) {
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
                                    const maxDisplay = 10;

                                    for(let i = 0; i < events.length; i++) {
                                        if (i >= maxDisplay) {
                                            lines.push(`... dan ${events.length - maxDisplay} lainnya.`);
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
    }
};