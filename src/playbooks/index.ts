import { registerPlaybook } from "@/engine/playbook-registry";
import ecommerce from "./ecommerce";
import customerSupport from "./customer-support";
import finance from "./finance";
import sales from "./sales";
import contentMarketing from "./content-marketing";
import hrRecruiting from "./hr-recruiting";
import legal from "./legal";
import devops from "./devops";

export function initializePlaybooks() {
  registerPlaybook(ecommerce);
  registerPlaybook(customerSupport);
  registerPlaybook(finance);
  registerPlaybook(sales);
  registerPlaybook(contentMarketing);
  registerPlaybook(hrRecruiting);
  registerPlaybook(legal);
  registerPlaybook(devops);
}

export const allPlaybooks = [
  ecommerce,
  customerSupport,
  finance,
  sales,
  contentMarketing,
  hrRecruiting,
  legal,
  devops,
];
