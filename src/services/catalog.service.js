import { createCrudService } from "./base.service";
import { workshopCollection } from "../firebase/paths";

export const mechanicsService = createCrudService("mechanics");
export const serviceCategoriesService = createCrudService("serviceCategories");
export const servicesService = createCrudService("services");

export const mechanicsRef = () => workshopCollection("mechanics");
export const serviceCategoriesRef = () => workshopCollection("serviceCategories");
export const servicesRef = () => workshopCollection("services");
