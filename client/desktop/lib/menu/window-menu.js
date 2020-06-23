'use strict';

/**
 * Internal dependencies
 */
const calypsoMenu = require( './calypso-menu' );
const platform = require( 'desktop/lib/platform' );

module.exports = function( mainWindow ) {
	let menu = calypsoMenu( mainWindow ).concat(
		{
			type: 'separator'
		},
		{
			label: 'Minimize',
			accelerator: 'CmdOrCtrl+M',
			role: 'minimize'
		},
		{
			label: 'Close',
			accelerator: 'CmdOrCtrl+W',
			role: 'close'
		}
	);

	if ( platform.isOSX() ) {
		menu.push( { type: 'separator' } );
		menu.push( { label: 'Bring All to Front', role: 'front' } );
	}

	return menu
};
