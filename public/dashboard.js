// dashboard.js

// Helper function to create DOM elements
function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
}

// Function to create a stat card
function createStatCard(title, value, icon) {
    const card = createElement('div', 'stat-card');
    card.innerHTML = `
        <h3>${title}</h3>
        <p>${value}</p>
        <span class="icon">${icon}</span>
    `;
    return card;
}

// Function to create the performance chart
function createPerformanceChart(data) {
    const chartContainer = createElement('div', 'chart-container');
    chartContainer.innerHTML = '<canvas id="performanceChart"></canvas>';
    
    // We'll use Chart.js to create the chart
    new Chart(document.getElementById('performanceChart'), {
        type: 'line',
        data: {
            labels: data.map(d => d.date),
            datasets: [{
                label: 'Performance',
                data: data.map(d => d.value),
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    return chartContainer;
}

// Function to create the recent actions list
function createRecentActionsList(actions) {
    const list = createElement('ul', 'recent-actions');
    actions.forEach(action => {
        const li = createElement('li', '', `${action.type}: ${action.description}`);
        list.appendChild(li);
    });
    return list;
}

// Main function to initialize the dashboard
async function initDashboard() {
    const dashboardContainer = document.getElementById('dashboard');
    
    try {
        // Fetch data (replace these with actual API calls)
        const stats = await fetch('/api/stats').then(res => res.json());
        const performanceData = await fetch('/api/performance').then(res => res.json());
        const recentActions = await fetch('/api/recent-actions').then(res => res.json());

        // Create stat cards
        const statCardsContainer = createElement('div', 'stat-cards');
        statCardsContainer.appendChild(createStatCard('AI Tasks', `${stats.ai.completedTasks}/${stats.ai.tasks}`, '🤖'));
        statCardsContainer.appendChild(createStatCard('Discord Messages', stats.discord.messages, '💬'));
        statCardsContainer.appendChild(createStatCard('Summarized Files', stats.summarizer.files, '📄'));
        statCardsContainer.appendChild(createStatCard('X Interactions', stats.x.tweets + stats.x.retweets, '🐦'));

        // Create performance chart
        const chartSection = createElement('section', 'chart-section');
        chartSection.appendChild(createElement('h2', '', 'Performance Over Time'));
        chartSection.appendChild(createPerformanceChart(performanceData));

        // Create recent actions list
        const actionsSection = createElement('section', 'actions-section');
        actionsSection.appendChild(createElement('h2', '', 'Recent Actions'));
        actionsSection.appendChild(createRecentActionsList(recentActions));

        // Append everything to the dashboard
        dashboardContainer.appendChild(statCardsContainer);
        dashboardContainer.appendChild(chartSection);
        dashboardContainer.appendChild(actionsSection);

    } catch (error) {
        console.error('Error initializing dashboard:', error);
        dashboardContainer.innerHTML = '<p>Error loading dashboard data.</p>';
    }
}

// Initialize the dashboard when the DOM is loaded
document.addEventListener('DOMContentLoaded', initDashboard);