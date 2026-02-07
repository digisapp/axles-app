import { NextRequest, NextResponse } from 'next/server';
import { decodeVIN } from '@/lib/vin/decoder';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { vin } = await request.json();

    if (!vin) {
      return NextResponse.json(
        { error: 'VIN is required' },
        { status: 400 }
      );
    }

    const result = decodeVIN(vin);

    // If we have a valid VIN with a make, try to get more details from NHTSA API
    if (result.isValid && result.make) {
      try {
        const nhtsaResponse = await fetch(
          `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin}?format=json`
        );

        if (nhtsaResponse.ok) {
          const nhtsaData = await nhtsaResponse.json();
          const results = nhtsaData.Results || [];

          // Extract useful fields from NHTSA
          const getField = (name: string) => {
            const field = results.find((r: { Variable: string }) => r.Variable === name);
            return field?.Value && field.Value !== 'Not Applicable' ? field.Value : null;
          };

          return NextResponse.json({
            success: true,
            data: {
              vin: vin.toUpperCase(),
              year: parseInt(getField('Model Year')) || result.year,
              make: getField('Make') || result.make,
              model: getField('Model'),
              trim: getField('Trim'),
              bodyClass: getField('Body Class'),
              vehicleType: getField('Vehicle Type'),
              driveType: getField('Drive Type'),
              fuelType: getField('Fuel Type - Primary'),
              engineCylinders: getField('Engine Number of Cylinders'),
              engineDisplacement: getField('Displacement (L)'),
              engineHP: getField('Engine Brake (hp) From'),
              transmissionStyle: getField('Transmission Style'),
              gvwr: getField('Gross Vehicle Weight Rating From'),
              country: getField('Plant Country') || result.country,
              isValid: true,
            },
          });
        }
      } catch (nhtsaError) {
        // Fall back to basic decode if NHTSA fails
        logger.error('NHTSA API error', { nhtsaError });
      }
    }

    // Return basic decode result
    return NextResponse.json({
      success: true,
      data: {
        vin: vin.toUpperCase(),
        ...result,
      },
    });
  } catch (error) {
    logger.error('VIN decode error', { error });
    return NextResponse.json(
      { error: 'Failed to decode VIN' },
      { status: 500 }
    );
  }
}
