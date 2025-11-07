
        document.addEventListener('DOMContentLoaded', function() {
            
            const STORAGE_KEY = 'healthDataRecords';
            const historyListEl = document.getElementById('history-list');
            const dailyDataForm = document.getElementById('daily-data-form');
            const saveMessageEl = document.getElementById('save-message');
            const tabs = document.querySelectorAll('.tab-button');
            const tabContents = document.querySelectorAll('.tab-content');

            let weightChartInstance = null;
            let waterChartInstance = null;
            
            // ------------------------------------
            // LocalStorage Utilities
            // ------------------------------------

            function loadRecords() {
                const data = localStorage.getItem(STORAGE_KEY);
                const records = data ? JSON.parse(data) : [];
                // តម្រៀបតាមកាលបរិច្ឆេទចាស់ទៅថ្មី
                return records.sort((a, b) => new Date(a.date) - new Date(b.date)); 
            }

            function saveRecord(newRecord) {
                const records = loadRecords();
                
                // ត្រួតពិនិត្យ និងជំនួសកំណត់ត្រាចាស់ (បើមាន)
                const existingIndex = records.findIndex(r => r.date === newRecord.date);
                
                if (existingIndex !== -1) {
                    records[existingIndex] = newRecord; // Update
                } else {
                    records.push(newRecord); // Add new
                }

                localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
            }

            // ------------------------------------
            // Form Handling (Add Data)
            // ------------------------------------

            dailyDataForm.addEventListener('submit', function(e) {
                e.preventDefault();
                
                const date = document.getElementById('date').value;
                const weight = parseFloat(document.getElementById('weight').value);
                const water = parseFloat(document.getElementById('water').value);
                const sleep = parseFloat(document.getElementById('sleep').value);
                
                if (isNaN(weight) || isNaN(water) || isNaN(sleep) || !date) {
                    saveMessageEl.textContent = "សូមបញ្ចូលទិន្នន័យឲ្យបានត្រឹមត្រូវ!";
                    return;
                }

                const newRecord = { date, weight, water, sleep };
                saveRecord(newRecord);
                
                saveMessageEl.textContent = "រក្សាទុកដោយជោគជ័យ!";
                dailyDataForm.reset();
                
                // ធ្វើបច្ចុប្បន្នភាព Dashboard និង History
                updateDashboard();
                renderHistory();
                
                setTimeout(() => saveMessageEl.textContent = '', 2000);
            });


            // ------------------------------------
            // Dashboard Rendering (Chart.js & KPIs)
            // ------------------------------------

            function calculateBMI(weight, height_m = 1.70) { 
                if (weight <= 0 || height_m <= 0) return 0;
                return weight / (height_m * height_m);
            }

            function getBMIDescription(bmi) {
                if (bmi < 18.5) return { status: 'ក្រោមទម្ងន់', color: '#f39c12' };
                if (bmi < 24.9) return { status: 'ធម្មតា', color: '#2ecc71' };
                if (bmi < 29.9) return { status: 'លើសទម្ងន់', color: '#e67e22' };
                return { status: 'ធាត់ខ្លាំង', color: '#e74c3c' };
            }

            function updateDashboard() {
                const records = loadRecords();
                if (records.length === 0) return;

                // --- KPI Calculations ---
                const latestRecord = records[records.length - 1];
                const latestBMI = calculateBMI(latestRecord.weight);
                const bmiDesc = getBMIDescription(latestBMI);
                
                const last7Days = records.slice(-7);
                const totalWater = last7Days.reduce((sum, r) => sum + r.water, 0);
                const avgSleep = (last7Days.reduce((sum, r) => sum + r.sleep, 0) / last7Days.length);

                // --- Update KPIs ---
                document.getElementById('current-bmi').textContent = latestBMI.toFixed(1);
                document.getElementById('bmi-status').textContent = `(${bmiDesc.status})`;
                document.getElementById('bmi-status').style.color = bmiDesc.color;
                document.getElementById('avg-sleep').textContent = `${avgSleep.toFixed(1)} ម៉ោង`;
                document.getElementById('total-water').textContent = `${totalWater.toFixed(1)} L`;

                // --- Render Charts ---
                renderWeightChart(records);
                renderWaterChart(last7Days);
            }

            function renderWeightChart(records) {
                if (weightChartInstance) weightChartInstance.destroy();
                
                const chartData = records.slice(-30);
                
                const ctx = document.getElementById('weightChart').getContext('2d');
                weightChartInstance = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: chartData.map(r => r.date),
                        datasets: [{
                            label: 'ទម្ងន់ (KG)',
                            data: chartData.map(r => r.weight),
                            borderColor: '#3498db',
                            tension: 0.3,
                            fill: false
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: { y: { beginAtZero: false } }
                    }
                });
            }

            function renderWaterChart(last7Days) {
                if (waterChartInstance) waterChartInstance.destroy();
                
                const totalWater7Days = last7Days.reduce((sum, r) => sum + r.water, 0);
                const waterGoal = 7 * 3; // គោលដៅ 3L ក្នុងមួយថ្ងៃ * 7 ថ្ងៃ = 21L
                const achievedPercentage = Math.min(100, (totalWater7Days / waterGoal) * 100);
                const remainingPercentage = 100 - achievedPercentage;

                const ctx = document.getElementById('waterChart').getContext('2d');
                waterChartInstance = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: ['សម្រេចបាន (%)', 'នៅសល់ (%)'],
                        datasets: [{
                            data: [achievedPercentage.toFixed(1), remainingPercentage.toFixed(1)],
                            backgroundColor: ['#2ecc71', '#bdc3c7'],
                            hoverOffset: 8
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'top' },
                            title: { display: true, text: `គោលដៅ 7 ថ្ងៃ (21L)` }
                        }
                    }
                });
            }


            // ------------------------------------
            // History and Tab Management
            // ------------------------------------

            function renderHistory() {
                const records = loadRecords().slice().reverse(); 
                historyListEl.innerHTML = '';
                
                if (records.length === 0) {
                    historyListEl.innerHTML = '<li>មិនទាន់មានទិន្នន័យ...</li>';
                    return;
                }

                records.slice(0, 10).forEach(r => { 
                    const li = document.createElement('li');
                    li.innerHTML = `
                        <strong>[${r.date}]</strong> | ទម្ងន់: ${r.weight} kg, ទឹក: ${r.water} L, គេង: ${r.sleep} ម៉ោង
                    `;
                    historyListEl.appendChild(li);
                });
            }

            // មុខងារសម្រាប់ប្តូរ Tabs
            tabs.forEach(button => {
                button.addEventListener('click', () => {
                    const targetTab = button.dataset.tab;
                    
                    tabs.forEach(btn => btn.classList.remove('active'));
                    tabContents.forEach(content => content.classList.remove('active'));

                    button.classList.add('active');
                    document.getElementById(targetTab).classList.add('active');

                    // ធ្វើបច្ចុប្បន្នភាពក្រាហ្វិកនៅពេលប្តូរទៅ Dashboard
                    if (targetTab === 'dashboard-view') {
                        // ត្រូវប្រើ setTimeout ដើម្បីធានាថា Canvas ត្រូវបាន render មុន Chart.js ចាប់ផ្តើម
                        setTimeout(updateDashboard, 100); 
                    }
                });
            });


            // ------------------------------------
            // ចាប់ផ្តើមកម្មវិធី
            // ------------------------------------
            renderHistory();
            // បើក Tab ដំបូង
            document.getElementById('data-entry').classList.add('active');
        });
