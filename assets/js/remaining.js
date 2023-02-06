function remaining() {
    const clientList = document.querySelectorAll('.employee-schedule-row');

    clientList.forEach( function( el, index )  {
        const clientName  = el.querySelector('.employee-client-name .employee-client-project');
        let resourcedTime = el.querySelector('.employee-client-hours');
        let usedTime      = el.querySelector('.employee-client-hours-logged');

        if( usedTime && resourcedTime ) {
            usedTime      = parseFloat( usedTime.textContent );
            resourcedTime = parseFloat( resourcedTime.textContent );

            const remainingTime = resourcedTime - usedTime;

            if ( clientName ) {
                let classList = 'employee-cell employee-client-hours-remaining ';
                if ( remainingTime >= 1 ){
                    // still have remaining time
                    classList += 'green-cell';
                } else if ( remainingTime > 0 && remainingTime < 1 ){
                    // getting close
                    classList += 'yellow-cell';
                } else if ( remainingTime < 0 ) {
                    // AT or Over
                    classList += 'red-cell';
                }
                el.insertAdjacentHTML( 'beforeend', '<div class="' + classList + '">' + parseFloat( remainingTime ).toFixed( 2 ) + '</div>' );
            } else {
                el.insertAdjacentHTML( 'beforeend', '<div class="employee-cell employee-client-hours-remaining" style="position: relative;">Hours Remaining</div>' );
            }
        } else {
            let resourcedTime = el.querySelector('.employee-schedule-total');
            let usedTime      = el.querySelector('.employee-client-hours-logged');
            usedTime      = parseFloat( usedTime.textContent );
            resourcedTime = parseFloat( resourcedTime.textContent );
            const remainingTime = resourcedTime - usedTime;

            el.insertAdjacentHTML( 'beforeend', '<div class="employee-cell employee-client-hours-remaining">' + parseFloat( remainingTime ).toFixed( 2 ) + '</div>' );
        }
    });
}

remaining();