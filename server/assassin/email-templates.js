const mail = require('./mailer.js')

// So Atom can syntax highlight this like HTML
const innerHTML = String.raw

module.exports = {
  mail: (address, { subject, text, html }) => mail({
    from: { name: 'Orbiit Elimination', address: 'sy24484@pausd.us' },
    to: { address },
    subject,
    text,
    html
  }),
  resetPassword: ({ username, resetID }) => ({
    subject: 'Reset your Elimination password',
    html: innerHTML`
      <div style="
        background-color: black;
        font-family: 'Playfair Display', serif;
        font-size: 0;
        color: white;
      ">
        <div style="
          padding: 10px 15px;
          border-bottom: 1px solid rgba(255, 0, 0, 0.2);
        ">
          <a href="https://orbiit.github.io/elimination/" style="
            text-decoration: none;
            font-size: 24px;
            color: white;
          ">Elimination</a>
        </div>
        <div style="
          font-size: 16px;
          line-height: 1.8;
          padding: 0 20px;
        ">
          <p>Hello @${username},</p>
          <p>We're sending you this email because you requested a password reset. Click on this link to create a new password:</p>
          <div style="
            text-align: center;
          ">
            <a href="https://orbiit.github.io/elimination/?reset-${resetID}" style="
              display: inline-block;
              padding: 10px 20px;
              font-size: 16px;
              background-color: #8a0303;
              color: white;
              text-decoration: none;
            ">Set a new password</a>
          </div>
          <p>This link will expire in 24 hours. If you didn't request a password reset, you can ignore this email, and your password won't be changed.</p>
        </div>
        <div style="
          padding: 10px;
          border-top: 1px solid rgba(255,0,0,.2);
          font-size: 14px;
        ">From the creators of <a href="https://gunn.app/" style="
          color: #faa;
          text-decoration: none;
        ">UGWA</a>.</div>
      </div>
    `.replace(/\s+/g, ' ')
  })
}
