document.addEventListener('DOMContentLoaded', () => {
    // 1. Authentication Logic
    const loginForm = document.getElementById('login-form');
    const errorMsg = document.getElementById('login-error');

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const user = document.getElementById('username').value;
        const pass = document.getElementById('password').value;
        const rememberMe = document.querySelector('input[type="checkbox"]').checked;

        if (user === 'admin' && pass === 'Delta@123') {
            // Successful login
            sessionStorage.setItem('isLoggedIn', 'true');
            if (rememberMe) {
                // If the user wants to stay logged in, we could use localStorage, 
                // but per original spec, we'll just set sessionStorage for now to fulfill "must login".
                localStorage.setItem('isLoggedIn', 'true');
            }
            window.location.href = 'index.html'; // Redirect to dashboard
        } else {
            // Failed login
            errorMsg.classList.add('active');
        }
    });

    // 2. Globe Visualization Logic
    const globeContainer = document.getElementById('globe-viz');
    
    // Generate random data points for arcs
    const N = 40;
    const arcsData = [...Array(N).keys()].map(() => ({
        startLat: (Math.random() - 0.5) * 180,
        startLng: (Math.random() - 0.5) * 360,
        endLat: (Math.random() - 0.5) * 180,
        endLng: (Math.random() - 0.5) * 360,
        color: ['rgba(16, 185, 129, 0.8)', 'rgba(59, 130, 246, 0.8)', 'rgba(139, 92, 246, 0.8)'][Math.floor(Math.random() * 3)]
    }));

    const world = Globe()
        (globeContainer)
        .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-night.jpg')
        .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
        .backgroundColor('rgba(0,0,0,0)') // Transparent to show gradient background
        .arcsData(arcsData)
        .arcColor('color')
        .arcDashLength(0.5)
        .arcDashGap(1)
        .arcDashInitialGap(() => Math.random())
        .arcDashAnimateTime(2500)
        .arcStroke(0.2);

    // Initial positioning (closer to the earth, offset to the right)
    world.pointOfView({ lat: 30, lng: -40, altitude: 1.2 });
    
    // Auto-rotate the globe slowly
    world.controls().autoRotate = true;
    world.controls().autoRotateSpeed = 0.5;
    world.controls().enableZoom = false; // Disable zoom to keep UI tight
    
    // Handle Window Resize
    window.addEventListener('resize', () => {
        world.width(globeContainer.clientWidth);
        world.height(globeContainer.clientHeight);
    });
});
