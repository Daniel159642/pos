import { Resend } from 'resend';
import { NextResponse } from 'next/server';

// Initialize Resend with your API key
// You should add RESEND_API_KEY to your .env file
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { firstName, lastName, email, businessName, businessType, message, website } = body;

        // Simple honeypot check
        if (website) {
            return NextResponse.json({ message: 'Bot detected' }, { status: 400 });
        }

        const fullName = lastName ? `${firstName} ${lastName}` : firstName;
        const subject = businessName ? `New Request: ${businessName} (${fullName})` : `New Request: ${fullName}`;

        const { data, error } = await resend.emails.send({
            from: 'Swftly <onboarding@resend.dev>',
            to: ['drlny11d@gmail.com'],
            subject: subject,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #2c19fc; border-bottom: 2px solid #2c19fc; padding-bottom: 10px;">New Website Request</h2>
                    <p><strong>Name:</strong> ${fullName}</p>
                    <p><strong>Business Name:</strong> ${businessName || 'Not specified'}</p>
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Business Type:</strong> ${businessType}</p>
                    <div style="margin-top: 20px; padding: 15px; background-color: #f9f9f9; border-radius: 5px;">
                        <p><strong>Message:</strong></p>
                        <p>${message || 'No additional message provided.'}</p>
                    </div>
                    <p style="font-size: 12px; color: #888; margin-top: 30px;">Sent via Swftly Website</p>
                </div>
            `,
        });

        if (error) {
            return NextResponse.json({ error }, { status: 400 });
        }

        return NextResponse.json({ data });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }
}
