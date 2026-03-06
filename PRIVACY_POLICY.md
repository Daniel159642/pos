## Privacy Policy

_Last updated: March 2, 2026_

This Privacy Policy describes how we collect, use, and protect information when you use our point-of-sale (“POS”) software and related services (“Services”).

By using the Services, you agree to the practices described in this Privacy Policy.

---

## 1. Information We Collect

- **Usage data (analytics)**  
  - We collect information about how you and your staff use the software (for example: features used, performance metrics, error logs, device/browser information).  
  - This data is used **only to operate, secure, and improve the software**, not to sell to third parties.

- **Business / inventory and transaction configuration data**  
  - You may input product, inventory, pricing, tax settings, and related business metadata into the system.  
  - We may use this data to **improve intelligent search, categorization, and metadata features** within the product (for example, to make it easier to find products or understand shipment line items).  
  - We **do not sell** your inventory or business data to third parties.

- **Shipment and document data (AI processing)**  
  - For certain features (such as shipment extraction, document understanding, or metadata extraction), we may send relevant snippets of text or document content to third‑party AI providers (currently including **Anthropic** and **OpenAI**) so they can return structured results.  
  - These providers process data in accordance with **their own privacy policies and terms**; where possible we configure them for business/enterprise use and do not permit them to use your data to train their public models.  
  - We design these features to focus on operational data (like product, quantity, and pricing details) and avoid unnecessary personal information.

- **Payment processing data**  
  - We primarily use **Stripe (for example, Stripe Connect)** and may support integrations with other payment processors or card terminals that you choose to use.  
  - **We do not store full credit card numbers, CVVs, or raw payment processing information on our servers.**  
  - Payment data is handled and stored (where necessary) by the relevant payment processor or terminal provider in accordance with **their own privacy policies and PCI‑DSS requirements**.

- **Integrations and third‑party services you connect**  
  - You may choose to connect third‑party services (for example: accounting systems, ecommerce platforms, delivery services, calendar integrations, messaging/SMS/email providers).  
  - When you enable an integration, we share only the data that is necessary for that integration to function (for example, transaction or inventory data to an accounting system, or shipment/order details to a delivery or ecommerce provider).  
  - Those providers’ use of your data is governed by **their own privacy policies**, which you should review.

We do **not** collect separate marketing profiles about your end‑customers beyond what is necessary for the functionality you enable in the product.

---

## 2. Information We Intentionally Do **Not** Store or Use for Our Own Purposes

- **Customer personal/payment data (beyond what is strictly necessary to provide the service)**  
  - We do **not** store or use detailed customer personal information and individual transaction information for our own independent purposes, other than what is required to provide the Services requested by you and to meet legal, tax, or security obligations.  
  - We do **not** store or manage your customers’ reward/loyalty profiles as a separate asset for our own marketing or resale.

- **Credit card details**  
  - We do **not** store your customers’ card numbers, CVVs, or magnetic stripe/chip data on our servers.  
  - Card data is transmitted directly to and stored by the integrated payment processors or terminal providers, subject to their policies.

- **Use of your data for our own accounting**  
  - We do **not** use your transactional or accounting data as input into our own internal accounting systems except as strictly necessary to bill you for our Services or comply with legal, tax, or auditing requirements.  
  - We do **not** resell or repurpose your accounting or financial data for third‑party advertising or data‑brokering.

---

## 3. How We Use Information

We use the information we collect for the following purposes:

- **To provide and maintain the Services**  
  - Operating the POS software, features, and integrations you choose to enable.  
  - Processing payments through the processors and terminals you configure.  
  - Providing customer support and resolving issues.

- **To improve and secure the product**  
  - Monitoring performance, debugging issues, and improving user experience.  
  - Developing and refining features such as intelligent search, metadata suggestions, and AI‑powered shipment/document processing (using your data in aggregate or anonymized form where possible).  
  - Testing and improving system reliability, scalability, and security.

- **To process requests through third‑party services**  
  - Sending data to payment processors to complete transactions you initiate.  
  - Sending shipment or related text to AI providers (Anthropic, OpenAI, and similar services) for extraction and analysis, subject to their privacy practices.  
  - Transmitting data to optional integrations you enable (for example, accounting, ecommerce, delivery, or calendar systems).

- **To communicate with you**  
  - Sending you service‑related communications (for example, system alerts, security notices, and feature updates).  
  - Where enabled, sending operational messages (for example, receipts, reminders, or notifications) to your staff or customers on your behalf via SMS, email, or other channels.

- **To comply with legal obligations**  
  - Responding to lawful requests from authorities where required.  
  - Maintaining records necessary for our own legal, security, and compliance obligations.

---

## 4. Database, Hosting, and Security

- **Database and hosting (including Neon)**  
  - Our primary application data is stored in a managed PostgreSQL database, which may be hosted by providers such as **Neon** or similar cloud database platforms.  
  - These providers are responsible for the underlying infrastructure, including physical security and encryption at rest, and they process data in accordance with their own security and privacy commitments.

- **Authentication and access control**  
  - Access to the administrative and POS interfaces is restricted to authenticated users (for example, via usernames, passwords, or PIN‑based logins that you manage).  
  - We implement role‑ and permission‑based access controls so that staff accounts can only perform actions appropriate for their role where this functionality is configured.  
  - We do not expose the database directly to the public internet; access is mediated through application services.

- **Encryption and secrets management**  
  - We use encryption in transit (for example, HTTPS/TLS) for communications between clients and our services wherever supported.  
  - Sensitive configuration values such as API keys and payment credentials are stored using environment variables and, where appropriate, additional encryption layers.  
  - We avoid logging sensitive fields and aim to limit logs to operational and diagnostic information.

- **Application and database security practices**  
  - We apply database‑level permissions so that application services use database roles with only the minimum privileges necessary (“least privilege”).  
  - We use input validation, structured query APIs, and other techniques intended to reduce common security risks such as injection attacks.  
  - We regularly review and update dependencies and infrastructure to address security issues over time.

While we take these measures seriously, no system can be guaranteed 100% secure. You are responsible for maintaining the security of your own devices, networks, and credentials.

---

## 5. Data Sharing

We may share information in the limited circumstances below:

- **Service providers and subprocessors**  
  - With vendors who help us provide the Services (for example: hosting providers, managed database providers such as Neon, analytics tools, payment processors, AI providers, messaging/SMS/email gateways, and other infrastructure partners).  
  - These parties are authorized to use your information only as necessary to perform services on our behalf and are subject to appropriate confidentiality and security obligations.

- **Payment processors and hardware terminals**  
  - With Stripe (for example, Stripe Connect) and any other payment gateways or terminals you choose to integrate.  
  - Their use of your information is governed by **their own privacy policies**, which you should review.

- **Optional accounting, ecommerce, delivery, and other integrations**  
  - With accounting providers, ecommerce platforms, delivery providers, calendar systems, and other third‑party tools that you explicitly connect to the Services.  
  - We only share the information required for the integration to function (for example, transaction data to an accounting system, or order/shipment details to a delivery provider).  
  - Each such provider’s handling of data is governed by their own terms and privacy policy.

- **Legal and safety requirements**  
  - When required by law, subpoena, or court order.  
  - When we believe it is necessary to protect our rights, safety, or the rights and safety of others, detect or prevent fraud, or address security or technical issues.

- **Business transfers**  
  - In connection with a merger, acquisition, or sale of assets, your data may be transferred as part of that transaction, subject to safeguards and continued protection consistent with this Policy.

We **do not sell** your data (including usage, inventory, or transaction data) to data brokers or for advertising purposes.

---

## 6. Data Retention

- We retain information only for as long as necessary to:
  - Provide and maintain the Services you use.  
  - Comply with legal, tax, or accounting obligations.  
  - Resolve disputes and enforce our agreements.

- When data is no longer required, we take steps to delete, anonymize, or aggregate it.

---

## 7. Security

We implement reasonable technical and organizational measures to protect your data, including:

- **Encryption in transit** using HTTPS/TLS where supported.  
- **Access controls and authentication** for administrative and POS interfaces.  
- **Segregation of environments and roles** in our database and application infrastructure.  
- **Monitoring and logging** focused on operational and security‑relevant events, not on building marketing profiles of your end‑customers.

However, no system can be guaranteed 100% secure, and you are responsible for maintaining the security of your own devices, networks, and credentials.

---

## 8. Your Responsibilities

- **Configuration choices**  
  - You are responsible for configuring which integrations (for example, payment processors, accounting tools, AI features, ecommerce, delivery, and calendar systems) you enable.  
  - You should review the privacy policies and terms of any third‑party services you connect to our platform.

- **Customer notices**  
  - You are responsible for providing any required privacy notices to your own customers and for ensuring your use of the Services complies with applicable laws (for example, data protection, consumer protection, and payment regulations).

- **Account and access management**  
  - You are responsible for managing user accounts, roles, and permissions within your organization, and for promptly revoking access for staff who leave or should no longer have access.

---

## 9. International Transfers

If we or our subprocessors process data in other countries, we will take appropriate steps to ensure that such transfers comply with applicable data protection laws, using mechanisms such as contractual safeguards where required.

---

## 10. Changes to This Policy

We may update this Privacy Policy from time to time. When we do, we will revise the “Last updated” date above and, where appropriate, provide additional notice (such as in‑app notifications).

Your continued use of the Services after any changes indicates your acceptance of the updated Policy.

---

## 11. Contact Us

If you have any questions about this Privacy Policy or our data practices, please contact us at:

**Swftly** (not yet a legal entity)  
**Email**: [privacy@swftly.com or your contact email]  
**Address**: New York City, NY, USA

